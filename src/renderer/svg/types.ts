import type { RenderModel } from '../../render-model'

export interface SvgRendererOptions {
  padding?: number
  nodeRadius?: number
  edgeStrokeWidth?: number
  fontSize?: number
}

export interface SvgRenderer {
  render(model: RenderModel, options?: SvgRendererOptions): string
}
