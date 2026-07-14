import { ForkTimelineGraphBuilder } from '../graph'
import { ForkTimelineLayout } from '../layout'
import { ForkTimelineRenderModelBuilder } from '../render-model'
import { SvgRenderer } from '../renderer'
import type { GitSourceInput, GitSourceSnapshot } from '../source'
import type {
  ForkTimelinePipeline as ForkTimelinePipelineContract,
  ForkTimelinePipelineDependencies,
  ForkTimelinePipelineResult,
  ForkTimelineSettings,
} from './types'

export class ForkTimelinePipeline<TInput = GitSourceInput> implements ForkTimelinePipelineContract<TInput> {
  private readonly dependencies: Required<
    Pick<ForkTimelinePipelineDependencies<TInput>, 'source' | 'graphBuilder' | 'renderModelBuilder' | 'renderer'>
  >

  constructor(dependencies: ForkTimelinePipelineDependencies<TInput>) {
    this.dependencies = {
      source: dependencies.source,
      graphBuilder: dependencies.graphBuilder ?? new ForkTimelineGraphBuilder(),
      renderModelBuilder: dependencies.renderModelBuilder ?? new ForkTimelineRenderModelBuilder(),
      renderer: dependencies.renderer ?? new SvgRenderer(),
    }
  }

  async render(input: TInput, settings: ForkTimelineSettings): Promise<ForkTimelinePipelineResult> {
    return this.renderSnapshot(await this.dependencies.source.loadRepository(input), settings)
  }

  renderSnapshot(snapshot: GitSourceSnapshot, settings: ForkTimelineSettings): ForkTimelinePipelineResult {
    const graphResult = this.dependencies.graphBuilder.build(snapshot, {
      mainNodeMode: settings.mainNodeMode,
      includeOpenPullRequests: settings.includeOpenPullRequests,
      pullRequestLimit: settings.pullRequestLimit,
    })
    const layout = new ForkTimelineLayout({ grouping: settings.grouping }).layout(graphResult.graph)
    const model = this.dependencies.renderModelBuilder.build(layout)

    return {
      svg: this.dependencies.renderer.render(model),
      snapshot,
      warnings: [...snapshot.warnings, ...graphResult.warnings],
    }
  }
}
