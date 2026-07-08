/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

const TOKEN_STORAGE_KEY = 'treebranch.github.token'

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
    window.localStorage.setItem(TOKEN_STORAGE_KEY, 'ghp_saved_token')

    renderApp()

    expect(getTokenInput().value).toBe('ghp_saved_token')
  })

  it('persists trimmed token changes and removes storage when cleared', () => {
    renderApp()

    changeInputValue(getTokenInput(), '  ghp_new_token  ')

    expect(getTokenInput().value).toBe('  ghp_new_token  ')
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('ghp_new_token')

    changeInputValue(getTokenInput(), '')

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
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
