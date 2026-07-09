import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from './MemoryCache'

describe('MemoryCache', () => {
  it('returns a stored value before its TTL expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T00:00:00Z'))
    const cache = new MemoryCache<string>()

    cache.set('repository', 'snapshot', 1_000)
    vi.advanceTimersByTime(999)

    expect(cache.get('repository')).toBe('snapshot')
    vi.useRealTimers()
  })

  it('removes and misses a stored value after its TTL expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T00:00:00Z'))
    const cache = new MemoryCache<string>()

    cache.set('repository', 'snapshot', 10)
    vi.advanceTimersByTime(10)

    expect(cache.get('repository')).toBeUndefined()
    vi.useRealTimers()
  })

  it('clears all stored values', () => {
    const cache = new MemoryCache<string>()
    cache.set('first', 'one', 1_000)
    cache.set('second', 'two', 1_000)

    cache.clear()

    expect(cache.get('first')).toBeUndefined()
    expect(cache.get('second')).toBeUndefined()
  })
})
