import { describe, expect, it } from 'vitest'
import { assertNodeRuntime } from './runtime'

describe('assertNodeRuntime', () => {
  it('accepts a Node runtime', () => {
    expect(() => assertNodeRuntime({ node: '24.0.0' })).not.toThrow()
  })

  it('rejects a non-Node runtime', () => {
    expect(() => assertNodeRuntime({})).toThrowError(
      'The treebranch CLI requires a Node.js runtime.',
    )
  })
})
