import type { RenderPipeline } from '../pipeline'
import type { LocalGitSourceInput } from '../source/local'

export interface CliOutput {
  writeOut(message: string): void
  writeError(message: string): void
}

export type LocalRenderPipeline = Pick<
  RenderPipeline<LocalGitSourceInput>,
  'render'
>

export interface RunCliDependencies {
  pipeline?: LocalRenderPipeline
  output?: CliOutput
  cwd?: string
}

export interface RenderCommand {
  kind: 'render'
  input: LocalGitSourceInput
  outputPath: string
}

export interface HelpCommand {
  kind: 'help'
}

export type CliCommand = RenderCommand | HelpCommand
