import type { BranchGraph } from '../graph'
import type { LayoutResult, TreeLayout as TreeLayoutContract } from './types'

export class TreeLayout implements TreeLayoutContract {
  layout(_branchGraph: BranchGraph): LayoutResult {
    return {
      nodes: [],
      edges: [],
    }
  }
}
