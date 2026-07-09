export interface SourceCache<T> {
  get(key: string): T | undefined
  set(key: string, value: T, ttlMs: number): void
  clear(): void
}
