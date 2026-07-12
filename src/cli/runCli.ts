import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { RenderPipeline } from '../pipeline'
import { GitSourceError } from '../source'
import { LocalGitSource } from '../source/local'
import type {
  CliCommand,
  CliOutput,
  LocalRenderPipeline,
  RunCliDependencies,
} from './types'

const HELP_TEXT = `Treebranch Mark

Usage:
  treebranch render <repository-path> [options]

Options:
  -o, --output <file>       SVG output path (default: branch.svg)
      --branch <name>       Render one local branch
      --max-commits <count> Maximum commits loaded per branch (default: 100)
  -h, --help                Show this help message`

class CliUsageError extends Error {}

export async function runCli(
  args: string[],
  dependencies: RunCliDependencies = {},
): Promise<number> {
  const output = dependencies.output ?? createProcessOutput()
  let command: CliCommand

  try {
    command = parseCliCommand(args)
  } catch (error) {
    output.writeError(getErrorMessage(error))
    output.writeError(HELP_TEXT)
    return 2
  }

  if (command.kind === 'help') {
    output.writeOut(HELP_TEXT)
    return 0
  }

  const pipeline = dependencies.pipeline ?? createLocalPipeline()
  const outputPath = resolve(dependencies.cwd ?? process.cwd(), command.outputPath)

  try {
    const result = await pipeline.render(command.input)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, result.svg, 'utf8')
    output.writeOut(`SVG written to ${outputPath}`)
    return 0
  } catch (error) {
    if (error instanceof GitSourceError) {
      output.writeError(`${error.code}: ${error.message}`)
      return 1
    }

    output.writeError(`unknown: ${getErrorMessage(error)}`)
    return 1
  }
}

function parseCliCommand(args: string[]): CliCommand {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      output: { type: 'string', short: 'o', default: 'branch.svg' },
      branch: { type: 'string' },
      'max-commits': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (parsed.values.help) {
    return { kind: 'help' }
  }

  const [command, repositoryPath, ...extraPositionals] = parsed.positionals

  if (command !== 'render') {
    throw new CliUsageError('Expected the render command.')
  }

  if (!repositoryPath) {
    throw new CliUsageError('A repository path is required.')
  }

  if (extraPositionals.length > 0) {
    throw new CliUsageError('Too many positional arguments.')
  }

  const outputPath = parsed.values.output?.trim()

  if (!outputPath) {
    throw new CliUsageError('The output path cannot be empty.')
  }

  const branch = parsed.values.branch?.trim()

  if (parsed.values.branch !== undefined && !branch) {
    throw new CliUsageError('The branch name cannot be empty.')
  }

  const maxCommits = parseMaxCommits(parsed.values['max-commits'])

  return {
    kind: 'render',
    input: {
      repositoryPath,
      ...(branch ? { branch } : {}),
      ...(maxCommits ? { options: { maxCommitsPerBranch: maxCommits } } : {}),
    },
    outputPath,
  }
}

function parseMaxCommits(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliUsageError('max-commits must be a positive integer.')
  }

  return parsed
}

function createLocalPipeline(): LocalRenderPipeline {
  return new RenderPipeline({ source: new LocalGitSource() })
}

function createProcessOutput(): CliOutput {
  return {
    writeOut(message) {
      process.stdout.write(`${message}\n`)
    },
    writeError(message) {
      process.stderr.write(`${message}\n`)
    },
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
