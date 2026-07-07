import type { BranchGraphBuilderContract, BranchGraphWarning } from '../graph'
import type { TreeLayoutContract } from '../layout'
import type { CommitParserContract, ParserWarning } from '../parser'
import type { RenderModelBuilderContract } from '../render-model'
import type { SvgRendererContract } from '../renderer'
import type { GitSource, GitSourceInput, GitSourceSnapshot } from '../source'

export interface RenderPipelineDependencies {
  source: GitSource
  parser?: CommitParserContract
  graphBuilder?: BranchGraphBuilderContract
  layout?: TreeLayoutContract
  renderModelBuilder?: RenderModelBuilderContract
  renderer?: SvgRendererContract
}

export interface RenderPipelineResult {
  svg: string
  snapshot: GitSourceSnapshot
  parserWarnings: ParserWarning[]
  graphWarnings: BranchGraphWarning[]
}

export interface RenderPipeline {
  render(input: GitSourceInput): Promise<RenderPipelineResult>
}
