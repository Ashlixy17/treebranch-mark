/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App, { GITHUB_TOKEN_STORAGE_KEY } from './App'

let container: HTMLDivElement
let root: Root | null = null
let originalLocalStorageDescriptor: PropertyDescriptor | undefined

beforeAll(() => {
  originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  })
})

beforeEach(() => {
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }

  root = null
  container.remove()
  window.localStorage.clear()
})

afterAll(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor)
  } else {
    Reflect.deleteProperty(window, 'localStorage')
  }
})

describe('App GitHub token input', () => {
  it('renders an optional password token input', () => {
    renderApp()

    const input = getTokenInput()

    expect(input.type).toBe('password')
    expect(input.placeholder).toBe('ghp_xxxxxxxxx')
    expect(document.body.textContent).toContain('GitHub Token (Optional)')
    expect(document.body.textContent).toContain('Stored locally and sent only to the GitHub API.')
  })

  it('restores the token from localStorage on startup', () => {
    expect(GITHUB_TOKEN_STORAGE_KEY).toBe('treebranch.github.token')
    window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, 'ghp_saved_token')

    renderApp()

    expect(getTokenInput().value).toBe('ghp_saved_token')
  })

  it('persists trimmed token changes and removes storage when cleared', () => {
    renderApp()

    changeInputValue(getTokenInput(), '  ghp_new_token  ')

    expect(getTokenInput().value).toBe('  ghp_new_token  ')
    expect(window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY)).toBe('ghp_new_token')

    changeInputValue(getTokenInput(), '')

    expect(window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('places the token field above the repository field', () => {
    renderApp()

    const tokenField = getTokenInput().closest('label')
    const repositoryField = document.querySelector<HTMLInputElement>('#repository')?.closest('label')

    expect(tokenField).not.toBeNull()
    expect(repositoryField).not.toBeNull()
    expect(tokenField?.compareDocumentPosition(repositoryField as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('uses the token for GitHub API requests without adding it to render input', async () => {
    const capturedHeaders: Headers[] = []
    const originalFetch = globalThis.fetch
    const rateLimitHeaders = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4978',
      'x-ratelimit-reset': '1783500000',
    }

    globalThis.fetch = (async (input, init) => {
      capturedHeaders.push(new Headers(init?.headers))

      const url = String(input)

      if (url.endsWith('/repos/vuejs/core')) {
        return jsonResponse({
          id: 1,
          name: 'core',
          full_name: 'vuejs/core',
          html_url: 'https://github.com/vuejs/core',
          description: null,
          stargazers_count: 1,
          default_branch: 'main',
          owner: { login: 'vuejs' },
        }, 200, rateLimitHeaders)
      }

      if (url.endsWith('/repos/vuejs/core/branches?per_page=100')) {
        return jsonResponse([
          {
            name: 'main',
            commit: {
              sha: 'aaaaaaa1111111111111111111111111111111111',
              url: 'https://api.github.com/repos/vuejs/core/commits/aaaaaaa1111111111111111111111111111111111',
            },
          },
        ], 200, rateLimitHeaders)
      }

      if (url.includes('/repos/vuejs/core/commits?')) {
        return jsonResponse([
          {
            sha: 'aaaaaaa1111111111111111111111111111111111',
            html_url: 'https://github.com/vuejs/core/commit/aaaaaaa1111111111111111111111111111111111',
            commit: {
              message: 'Initial commit',
              author: {
                name: 'Mona',
                email: 'mona@example.com',
                date: '2026-01-01T00:00:00Z',
              },
              committer: {
                name: 'Mona',
                email: 'mona@example.com',
                date: '2026-01-01T00:00:00Z',
              },
            },
            author: null,
            committer: null,
            parents: [],
          },
        ], 200, rateLimitHeaders)
      }

      return jsonResponse({}, 404)
    }) as typeof fetch

    try {
      renderApp()
      changeInputValue(getTokenInput(), 'ghp_submit_token')

      await submitRepositoryForm()

      expect(capturedHeaders.length).toBeGreaterThan(0)
      expect(capturedHeaders.every((headers) => headers.get('authorization') === 'Bearer ghp_submit_token')).toBe(
        true,
      )
      expect(document.body.textContent).toContain('vuejs/core')
      expect(document.body.textContent).toContain('GitHub API Status')
      expect(document.body.textContent).toContain('Authenticated')
      expect(document.body.textContent).toContain('Remaining: 4978 / 5000')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('shows a focused authentication message for invalid tokens', async () => {
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async () => jsonResponse({}, 401)) as typeof fetch

    try {
      renderApp()
      changeInputValue(getTokenInput(), 'ghp_invalid_token')

      await submitRepositoryForm()

      expect(document.body.textContent).toContain(
        'Authentication failed. Please verify your GitHub Personal Access Token.',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

function renderApp() {
  root = createRoot(container)

  act(() => {
    root?.render(<App />)
  })
}

function getTokenInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('#github-token')

  expect(input).not.toBeNull()
  return input as HTMLInputElement
}

function changeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set

  act(() => {
    valueSetter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submitRepositoryForm() {
  const form = document.querySelector<HTMLFormElement>('.repo-form')

  expect(form).not.toBeNull()

  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}
