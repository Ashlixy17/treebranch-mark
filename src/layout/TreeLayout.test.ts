import { describe, expect, it } from 'vitest'
import type { BranchGraph } from '../graph'
import { TreeLayout } from './TreeLayout'

describe('TreeLayout', () => {
  it('returns an empty layout for an empty branch graph', () => {
    const layout = new TreeLayout()
    const graph: BranchGraph = {
      branches: new Map(),
    }

    expect(layout.layout(graph)).toEqual({
      nodes: [],
      edges: [],
    })
  })
})
