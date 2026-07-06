import type { GitSourceSnapshot } from '../source'
import type { CommitNode, CommitParser as CommitParserContract, ParserResult } from './types'

export class CommitParser implements CommitParserContract {
  parse(snapshot: GitSourceSnapshot): ParserResult {
    const nodes = new Map<string, CommitNode>()
    const warnings: ParserResult['warnings'] = []

    for (const commit of snapshot.commits) {
      if (nodes.has(commit.sha)) {
        warnings.push({
          type: 'duplicate-sha',
          commitSha: commit.sha,
          message: `Duplicate commit ${commit.sha} was ignored.`,
        })
        continue
      }

      nodes.set(commit.sha, {
        commit,
        parents: [],
        children: [],
      })
    }

    for (const node of nodes.values()) {
      for (const parentSha of node.commit.parents) {
        const parent = nodes.get(parentSha)

        if (!parent) {
          warnings.push({
            type: 'missing-parent',
            commitSha: node.commit.sha,
            parentSha,
            message: `Commit ${node.commit.sha} references missing parent ${parentSha}.`,
          })
          continue
        }

        node.parents.push(parent)
        parent.children.push(node)
      }
    }

    return {
      graph: {
        nodes,
        roots: [...nodes.values()].filter((node) => node.parents.length === 0),
      },
      warnings,
    }
  }
}
