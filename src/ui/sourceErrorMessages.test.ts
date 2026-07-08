import { describe, expect, it } from 'vitest'
import { formatSourceError } from './sourceErrorMessages'
import type { GitSourceErrorCode } from '../source'

describe('formatSourceError', () => {
  it('formats rate limit errors with the selected language message', () => {
    const messages: Record<GitSourceErrorCode, string> = {
      'not-found': '仓库不存在或不是公开仓库。',
      'rate-limited': 'GitHub API 请求次数已用完，请稍后再试。',
      'network-error': '网络请求失败，请检查网络连接。',
      'unsupported-source': '当前不支持该数据源。',
      'bad-credentials': 'GitHub Token 无效。',
      unknown: '仓库无法加载。',
    }

    expect(formatSourceError('rate-limited', messages)).toBe(
      'rate-limited: GitHub API 请求次数已用完，请稍后再试。',
    )
  })

  it('formats bad credential errors with the selected language message', () => {
    const messages: Record<GitSourceErrorCode, string> = {
      'not-found': 'Repository not found.',
      'rate-limited': 'GitHub API rate limit exceeded.',
      'network-error': 'Network request failed.',
      'unsupported-source': 'Unsupported source.',
      'bad-credentials': 'GitHub Token is invalid.',
      unknown: 'Repository could not be loaded.',
    }

    expect(formatSourceError('bad-credentials', messages)).toBe(
      'bad-credentials: GitHub Token is invalid.',
    )
  })
})
