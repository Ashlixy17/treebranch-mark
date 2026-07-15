import type {
  BranchGraphBuilderContract,
  BranchGraphWarning,
  ForkTimelineGraphBuilderContract,
  MainNodeMode,
} from '../graph'
import type { ForkTimelineLayoutResult, Layout, TimelineGrouping, TimelineSpacing } from '../layout'
import type { CommitParserContract, ParserWarning } from '../parser'
import type { RenderModel, RenderModelBuilderContract } from '../render-model'
import type { SvgRendererContract } from '../renderer'
import type { GitSource, GitSourceInput, GitSourceSnapshot } from '../source'

export interface RenderPipelineDependencies<TInput = GitSourceInput> {
  source: GitSource<TInput>
  parser?: CommitParserContract
  graphBuilder?: BranchGraphBuilderContract
  layout?: Layout
  renderModelBuilder?: RenderModelBuilderContract
  renderer?: SvgRendererContract
}

export interface RenderPipelineResult {
  svg: string
  snapshot: GitSourceSnapshot
  parserWarnings: ParserWarning[]
  graphWarnings: BranchGraphWarning[]
}

export interface RenderPipeline<TInput = GitSourceInput> {
  render(input: TInput): Promise<RenderPipelineResult>
  renderSnapshot(snapshot: GitSourceSnapshot, overrides?: { layout?: Layout }): RenderPipelineResult
}

export interface ForkTimelineSettings {
  grouping: TimelineGrouping
  spacing?: TimelineSpacing
  mainNodeMode: MainNodeMode
  includeOpenPullRequests: boolean
  pullRequestLimit: 10 | 20 | 50
}

export interface ForkTimelinePipelineDependencies<TInput = GitSourceInput> {
  source: GitSource<TInput>
  graphBuilder?: ForkTimelineGraphBuilderContract
  renderModelBuilder?: {
    build(layout: ForkTimelineLayoutResult): RenderModel
  }
  renderer?: SvgRendererContract
}

export interface ForkTimelinePipelineResult {
  svg: string
  snapshot: GitSourceSnapshot
  warnings: Array<{ message: string; pullRequestNumber?: number }>
}

export interface ForkTimelinePipeline<TInput = GitSourceInput> {
  render(input: TInput, settings: ForkTimelineSettings): Promise<ForkTimelinePipelineResult>
  renderSnapshot(snapshot: GitSourceSnapshot, settings: ForkTimelineSettings): ForkTimelinePipelineResult
}
