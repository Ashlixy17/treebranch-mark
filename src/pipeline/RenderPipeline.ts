import { BranchGraphBuilder } from '../graph'
import { TreeLayout } from '../layout'
import { CommitParser } from '../parser'
import { RenderModelBuilder } from '../render-model'
import { SvgRenderer } from '../renderer'
import type {
  RenderPipeline as RenderPipelineContract,
  RenderPipelineDependencies,
  RenderPipelineResult,
} from './types'
import type { GitSourceInput } from '../source'

export class RenderPipeline<TInput = GitSourceInput> implements RenderPipelineContract<TInput> {
  private readonly dependencies: Required<RenderPipelineDependencies<TInput>>

  constructor(dependencies: RenderPipelineDependencies<TInput>) {
    this.dependencies = {
      source: dependencies.source,
      parser: dependencies.parser ?? new CommitParser(),
      graphBuilder: dependencies.graphBuilder ?? new BranchGraphBuilder(),
      layout: dependencies.layout ?? new TreeLayout(),
      renderModelBuilder: dependencies.renderModelBuilder ?? new RenderModelBuilder(),
      renderer: dependencies.renderer ?? new SvgRenderer(),
    }
  }

  async render(input: TInput): Promise<RenderPipelineResult> {
    const snapshot = await this.dependencies.source.loadRepository(input)
    const parserResult = this.dependencies.parser.parse(snapshot)
    const graphResult = this.dependencies.graphBuilder.build(parserResult.graph, snapshot.branches)
    const layout = this.dependencies.layout.layout(graphResult.graph)
    const renderModel = this.dependencies.renderModelBuilder.build(layout, graphResult.graph)

    return {
      svg: this.dependencies.renderer.render(renderModel),
      snapshot,
      parserWarnings: parserResult.warnings,
      graphWarnings: graphResult.warnings,
    }
  }
}
