import type { ForkTimelineGraph, ForkTimelineLane } from '../graph'
import type { GitCommit } from '../source'
import {
  BRANCH_LANE_GAP,
  COMMIT_COLUMN_GAP,
} from './types'
import type {
  ForkTimelineLayoutEdge,
  ForkTimelineLayoutNode,
  ForkTimelineLayoutOptions,
  ForkTimelineLayoutResult,
  ForkTimelineLaneLabel,
  LayoutGroup,
  TimelineGrouping,
} from './types'

const MAIN_COLOR = '#2563eb'
const PR_COLORS = [
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
  '#4f46e5',
]

interface TimelineItem {
  id: string
  laneId: string
  laneIndex: number
  commit: GitCommit
  kind: ForkTimelineLayoutNode['kind']
  labels: ForkTimelineLayoutNode['labels']
  junction: boolean
  color: string
  isMain: boolean
  order: number
}

interface LaneAssignment {
  lane: ForkTimelineLane
  laneIndex: number
  startX: number
  endX: number
}

export class ForkTimelineLayout {
  private readonly grouping: TimelineGrouping

  constructor(options: ForkTimelineLayoutOptions = {}) {
    this.grouping = options.grouping ?? 'month'
  }

  layout(graph: ForkTimelineGraph): ForkTimelineLayoutResult {
    const laneAssignments = assignLanes(graph)
    const colors = assignColors(graph)
    const items = collectItems(graph, laneAssignments, colors)
    const orderedItems = [...items].sort(compareItems)
    const xById = new Map(orderedItems.map((item, index) => [item.id, index * COMMIT_COLUMN_GAP]))
    const nodes = orderedItems.map((item) => ({
      id: item.id,
      x: xById.get(item.id) ?? 0,
      y: item.laneIndex * BRANCH_LANE_GAP,
      laneId: item.laneId,
      laneIndex: item.laneIndex,
      kind: item.kind,
      commit: item.commit,
      labels: item.labels,
      junction: item.junction,
      color: item.color,
    }))
    const edges = createEdges(graph, laneAssignments, xById, colors)

    return {
      nodes,
      edges,
      groups: collectGroups(orderedItems, xById, this.grouping),
      laneLabels: createLaneLabels(graph, laneAssignments, xById, colors),
    }
  }
}

function collectItems(
  graph: ForkTimelineGraph,
  assignments: Map<string, LaneAssignment>,
  colors: Map<string, string>,
): TimelineItem[] {
  const items: TimelineItem[] = graph.mainEvents.map((event, order) => ({
    id: event.id,
    laneId: 'main',
    laneIndex: 0,
    commit: event.commit,
    kind: event.junction && event.visibleKind === null ? 'junction' : event.visibleKind,
    labels: event.labels,
    junction: event.junction,
    color: MAIN_COLOR,
    isMain: true,
    order,
  }))

  for (const lane of graph.lanes) {
    const assignment = assignments.get(lane.id)
    if (!assignment) {
      continue
    }

    lane.commits.forEach((commit, index) => {
      items.push({
        id: `${lane.id}-${commit.sha}`,
        laneId: lane.id,
        laneIndex: assignment.laneIndex,
        commit,
        kind: 'commit',
        labels: [],
        junction: false,
        color: colors.get(lane.id) ?? MAIN_COLOR,
        isMain: false,
        order: index,
      })
    })
  }

  return items
}

function assignLanes(graph: ForkTimelineGraph): Map<string, LaneAssignment> {
  const temporaryX = new Map<string, number>()
  const events = [
    ...graph.mainEvents.map((event) => ({ id: event.id, commit: event.commit })),
    ...graph.lanes.flatMap((lane) => lane.commits.map((commit) => ({
      id: `${lane.id}-${commit.sha}`,
      commit,
    }))),
  ].sort((left, right) => timestamp(left.commit) - timestamp(right.commit))
  events.forEach((event, index) => temporaryX.set(event.id, index * COMMIT_COLUMN_GAP))
  const mainX = new Map(graph.mainEvents.map((event) => [event.commit.sha, temporaryX.get(event.id) ?? 0]))
  const assignments = new Map<string, LaneAssignment>()
  const occupied: LaneAssignment[] = []
  let preferredSide = -1

  for (const lane of graph.lanes.filter((candidate) => candidate.mergeAnchor !== null)) {
    const startX = mainX.get(lane.forkAnchor.commitSha) ?? 0
    const endX = mainX.get(lane.mergeAnchor!.commitSha) ?? startX
    let laneIndex = preferredSide
    while (occupied.some((entry) => entry.laneIndex === laneIndex && overlaps(entry, startX, endX))) {
      laneIndex += preferredSide
    }
    const assignment = { lane, laneIndex, startX, endX }
    assignments.set(lane.id, assignment)
    occupied.push(assignment)
    preferredSide *= -1
  }

  const outer = Math.max(1, ...occupied.map((entry) => Math.abs(entry.laneIndex))) + 1
  let openSide = 1
  for (const lane of graph.lanes.filter((candidate) => candidate.mergeAnchor === null)) {
    const assignment = {
      lane,
      laneIndex: outer * openSide,
      startX: mainX.get(lane.forkAnchor.commitSha) ?? 0,
      endX: Number.POSITIVE_INFINITY,
    }
    assignments.set(lane.id, assignment)
    openSide *= -1
  }

  return assignments
}

function overlaps(assignment: LaneAssignment, startX: number, endX: number): boolean {
  return assignment.startX < endX && startX < assignment.endX
}

function assignColors(graph: ForkTimelineGraph): Map<string, string> {
  const colors = new Map<string, string>()
  const used = new Set<string>()

  for (const lane of graph.lanes) {
    const seed = hash(`${graph.repositoryFullName}:${lane.pullRequest.number}`)
    let index = seed % PR_COLORS.length
    while (used.has(PR_COLORS[index])) {
      index = (index + 1) % PR_COLORS.length
    }
    const color = PR_COLORS[index]
    colors.set(lane.id, color)
    used.add(color)
  }

  return colors
}

function createEdges(
  graph: ForkTimelineGraph,
  assignments: Map<string, LaneAssignment>,
  xById: Map<string, number>,
  colors: Map<string, string>,
): ForkTimelineLayoutEdge[] {
  const edges: ForkTimelineLayoutEdge[] = []

  for (let index = 1; index < graph.mainEvents.length; index += 1) {
    const from = graph.mainEvents[index - 1]
    const to = graph.mainEvents[index]
    edges.push({
      id: `main-${from.id}-${to.id}`,
      from: from.id,
      to: to.id,
      kind: 'main',
      color: MAIN_COLOR,
      inferred: false,
      path: null,
    })
  }

  for (const lane of graph.lanes) {
    const assignment = assignments.get(lane.id)
    const color = colors.get(lane.id) ?? MAIN_COLOR
    if (!assignment || lane.commits.length === 0) {
      continue
    }

    for (let index = 1; index < lane.commits.length; index += 1) {
      const fromId = `${lane.id}-${lane.commits[index - 1].sha}`
      const toId = `${lane.id}-${lane.commits[index].sha}`
      edges.push({
        id: `${lane.id}-branch-${index}`,
        from: fromId,
        to: toId,
        kind: 'branch',
        color,
        inferred: false,
        path: null,
      })
    }

    const firstId = `${lane.id}-${lane.commits[0].sha}`
    const forkId = `main-${lane.forkAnchor.commitSha}`
    edges.push({
      id: `${lane.id}-fork`,
      from: forkId,
      to: firstId,
      kind: 'fork',
      color,
      inferred: lane.forkAnchor.inferred,
      path: pathBetween(xById.get(forkId) ?? 0, 0, xById.get(firstId) ?? 0, assignment.laneIndex * BRANCH_LANE_GAP),
    })

    if (lane.mergeAnchor) {
      const lastId = `${lane.id}-${lane.commits.at(-1)!.sha}`
      const mergeId = `main-${lane.mergeAnchor.commitSha}`
      edges.push({
        id: `${lane.id}-merge`,
        from: lastId,
        to: mergeId,
        kind: 'merge',
        color,
        inferred: lane.mergeAnchor.inferred,
        path: pathBetween(
          xById.get(lastId) ?? 0,
          assignment.laneIndex * BRANCH_LANE_GAP,
          xById.get(mergeId) ?? 0,
          0,
        ),
      })
    }
  }

  return edges
}

function createLaneLabels(
  graph: ForkTimelineGraph,
  assignments: Map<string, LaneAssignment>,
  xById: Map<string, number>,
  colors: Map<string, string>,
): ForkTimelineLaneLabel[] {
  return graph.lanes.flatMap((lane) => {
    const assignment = assignments.get(lane.id)
    const first = lane.commits[0]
    if (!assignment || !first) {
      return []
    }

    return [{
      id: lane.id,
      x: xById.get(`${lane.id}-${first.sha}`) ?? 0,
      y: assignment.laneIndex * BRANCH_LANE_GAP - 22,
      text: `${lane.pullRequest.authorLogin ?? 'unknown'}:${lane.pullRequest.headBranch} · #${lane.pullRequest.number}`,
      color: colors.get(lane.id) ?? MAIN_COLOR,
      url: lane.pullRequest.url,
      badge: lane.pullRequest.state === 'open' ? 'open' : null,
    }]
  })
}

function collectGroups(
  items: TimelineItem[],
  xById: Map<string, number>,
  grouping: TimelineGrouping,
): LayoutGroup[] {
  const groups: LayoutGroup[] = []
  for (const item of items) {
    const date = new Date(timestamp(item.commit))
    const group = groupForDate(date, grouping)
    const x = xById.get(item.id) ?? 0
    const current = groups.at(-1)
    if (current?.id === group.id) {
      current.endX = x
    } else {
      groups.push({ ...group, startX: x, endX: x })
    }
  }
  return groups
}

function groupForDate(date: Date, grouping: TimelineGrouping): Pick<LayoutGroup, 'id' | 'label'> {
  if (!Number.isFinite(date.getTime())) {
    return { id: 'unknown-date', label: 'Unknown date' }
  }
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  if (grouping === 'year') {
    return { id: year, label: year }
  }
  const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  if (grouping === 'month') {
    return { id: month, label: month }
  }
  return { id: `${month}-${String(date.getUTCDate()).padStart(2, '0')}`, label: `${month}-${String(date.getUTCDate()).padStart(2, '0')}` }
}

function compareItems(left: TimelineItem, right: TimelineItem): number {
  return timestamp(left.commit) - timestamp(right.commit)
    || Number(right.isMain) - Number(left.isMain)
    || left.laneId.localeCompare(right.laneId)
    || left.commit.sha.localeCompare(right.commit.sha)
    || left.order - right.order
}

function timestamp(commit: GitCommit): number {
  const value = commit.committedAt ?? commit.authoredAt
  if (!value) {
    return Number.POSITIVE_INFINITY
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

function pathBetween(fromX: number, fromY: number, toX: number, toY: number): string {
  const controlX = fromX + (toX - fromX) / 2
  return `M ${fromX} ${fromY} C ${controlX} ${fromY}, ${controlX} ${toY}, ${toX} ${toY}`
}

function hash(value: string): number {
  let result = 2166136261
  for (const character of value) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return Math.abs(result)
}
