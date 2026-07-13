import type { BranchGraphBuilderContract, BranchGraphWarning } from '../graph'
import type { Layout } from '../layout'
import type { CommitParserContract, ParserWarning } from '../parser'
import type { RenderModelBuilderContract } from '../render-model'
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
