import type { GitSourceErrorCode } from '../source'

export type SourceErrorMessages = Record<GitSourceErrorCode, string>

export function formatSourceError(
  code: GitSourceErrorCode,
  messages: SourceErrorMessages,
): string {
  return `${code}: ${messages[code]}`
}
