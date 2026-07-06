import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { GitHubApiSource, GitSourceError, parseRepositoryInput } from './source'
import type { GitSourceSnapshot } from './source'

function App() {
  const [repositoryInput, setRepositoryInput] = useState('vuejs/core')
  const [branchInput, setBranchInput] = useState('main')
  const [snapshot, setSnapshot] = useState<GitSourceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setSnapshot(null)

    try {
      const source = new GitHubApiSource()
      const repository = parseRepositoryInput(repositoryInput)
      const nextSnapshot = await source.loadRepository({
        ...repository,
        branch: branchInput.trim() || undefined,
        options: {
          maxCommitsPerBranch: 20,
          includeContributors: false,
          includePullRequests: false,
        },
      })

      setSnapshot(nextSnapshot)
    } catch (caughtError) {
      if (caughtError instanceof GitSourceError) {
        setError(`${caughtError.code}: ${caughtError.message}`)
      } else {
        setError('unknown: Repository could not be loaded.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="header">
          <p className="eyebrow">treebranch-mark</p>
          <h1>Git source snapshot</h1>
        </header>

        <form className="repo-form" onSubmit={handleSubmit}>
          <div className="input-row">
            <label className="field" htmlFor="repository">
              <span>Repository</span>
              <input
                id="repository"
                value={repositoryInput}
                onChange={(event) => setRepositoryInput(event.target.value)}
                placeholder="owner/repo"
              />
            </label>
            <label className="field branch-field" htmlFor="branch">
              <span>Branch</span>
              <input
                id="branch"
                value={branchInput}
                onChange={(event) => setBranchInput(event.target.value)}
                placeholder="main"
              />
            </label>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Loading' : 'Load'}
            </button>
          </div>
        </form>

        {error && <p className="error">{error}</p>}

        {snapshot && (
          <section className="snapshot" aria-label="Git source snapshot summary">
            <dl>
              <div>
                <dt>Repository</dt>
                <dd>{snapshot.repository.fullName}</dd>
              </div>
              <div>
                <dt>Branches</dt>
                <dd>{snapshot.branches.length}</dd>
              </div>
              <div>
                <dt>Commits</dt>
                <dd>{snapshot.commits.length}</dd>
              </div>
              <div>
                <dt>Contributors</dt>
                <dd>{snapshot.contributors.length}</dd>
              </div>
              <div>
                <dt>Merged PRs</dt>
                <dd>{snapshot.pullRequests.length}</dd>
              </div>
            </dl>
            <pre>{JSON.stringify(snapshot, null, 2)}</pre>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
