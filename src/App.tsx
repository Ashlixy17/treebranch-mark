import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { GitHubApiSource, GitSourceError, parseRepositoryInput } from './source'
import type { GitSourceSnapshot } from './source'

type Language = 'en' | 'zh-CN' | 'ja'
type StatusKey = 'idle' | 'loading' | 'error' | 'ready'
type Theme = 'light' | 'dark'

interface Translation {
  application: string
  sourceLayer: string
  status: Record<StatusKey, string>
  language: string
  eyebrow: string
  title: string
  fetched: string
  notLoaded: string
  repositoryControls: string
  repository: string
  branch: string
  loadSnapshot: string
  requestFailed: string
  snapshotSummary: string
  branches: string
  commits: string
  contributors: string
  mergedPrs: string
  open: string
  owner: string
  defaultBranch: string
  stars: string
  branchHead: string
  name: string
  headSha: string
  latestCommit: string
  snapshotJson: string
  noSnapshot: string
  waitingPayload: string
  useDarkTheme: string
  useLightTheme: string
}

const languageOptions: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'ja', label: '日本語' },
]

const translations = {
  en: {
    application: 'Application',
    sourceLayer: 'Source Layer',
    status: {
      idle: 'Idle',
      loading: 'Loading',
      error: 'Error',
      ready: 'Ready',
    },
    language: 'Language',
    eyebrow: 'Git History Model',
    title: 'Source snapshot console',
    fetched: 'Fetched',
    notLoaded: 'Not loaded',
    repositoryControls: 'Repository controls',
    repository: 'Repository',
    branch: 'Branch',
    loadSnapshot: 'Load snapshot',
    requestFailed: 'Request failed',
    snapshotSummary: 'Git source snapshot summary',
    branches: 'Branches',
    commits: 'Commits',
    contributors: 'Contributors',
    mergedPrs: 'Merged PRs',
    open: 'Open',
    owner: 'Owner',
    defaultBranch: 'Default branch',
    stars: 'Stars',
    branchHead: 'Branch head',
    name: 'Name',
    headSha: 'Head SHA',
    latestCommit: 'Latest commit',
    snapshotJson: 'Snapshot JSON',
    noSnapshot: 'No snapshot loaded',
    waitingPayload: 'Waiting for normalized source payload.',
    useDarkTheme: 'Switch to dark mode',
    useLightTheme: 'Switch to light mode',
  },
  'zh-CN': {
    application: '应用',
    sourceLayer: 'Source 层',
    status: {
      idle: '待机',
      loading: '加载中',
      error: '错误',
      ready: '就绪',
    },
    language: '语言',
    eyebrow: 'Git 历史模型',
    title: 'Source 快照控制台',
    fetched: '获取时间',
    notLoaded: '尚未加载',
    repositoryControls: '仓库控制',
    repository: '仓库',
    branch: '分支',
    loadSnapshot: '加载快照',
    requestFailed: '请求失败',
    snapshotSummary: 'Git Source 快照摘要',
    branches: '分支',
    commits: '提交',
    contributors: '贡献者',
    mergedPrs: '已合并 PR',
    open: '打开',
    owner: '所有者',
    defaultBranch: '默认分支',
    stars: 'Stars',
    branchHead: '分支 HEAD',
    name: '名称',
    headSha: 'Head SHA',
    latestCommit: '最新提交',
    snapshotJson: '快照 JSON',
    noSnapshot: '尚无快照',
    waitingPayload: '等待标准化 Source 数据。',
    useDarkTheme: '切换到暗夜模式',
    useLightTheme: '切换到亮色模式',
  },
  ja: {
    application: 'アプリケーション',
    sourceLayer: 'Source レイヤー',
    status: {
      idle: '待機中',
      loading: '読み込み中',
      error: 'エラー',
      ready: '準備完了',
    },
    language: '言語',
    eyebrow: 'Git 履歴モデル',
    title: 'Source スナップショットコンソール',
    fetched: '取得日時',
    notLoaded: '未読み込み',
    repositoryControls: 'リポジトリ操作',
    repository: 'リポジトリ',
    branch: 'ブランチ',
    loadSnapshot: 'スナップショットを読み込む',
    requestFailed: 'リクエスト失敗',
    snapshotSummary: 'Git Source スナップショット概要',
    branches: 'ブランチ',
    commits: 'コミット',
    contributors: 'コントリビューター',
    mergedPrs: 'マージ済み PR',
    open: '開く',
    owner: '所有者',
    defaultBranch: 'デフォルトブランチ',
    stars: 'Stars',
    branchHead: 'ブランチ HEAD',
    name: '名前',
    headSha: 'Head SHA',
    latestCommit: '最新コミット',
    snapshotJson: 'スナップショット JSON',
    noSnapshot: 'スナップショット未読み込み',
    waitingPayload: '標準化された Source データを待っています。',
    useDarkTheme: 'ダークモードに切り替え',
    useLightTheme: 'ライトモードに切り替え',
  },
} satisfies Record<Language, Translation>

function App() {
  const [language, setLanguage] = useState<Language>('en')
  const [theme, setTheme] = useState<Theme>('light')
  const [repositoryInput, setRepositoryInput] = useState('vuejs/core')
  const [branchInput, setBranchInput] = useState('main')
  const [snapshot, setSnapshot] = useState<GitSourceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const t = translations[language]
  const statusKey: StatusKey = isLoading ? 'loading' : error ? 'error' : snapshot ? 'ready' : 'idle'
  const latestCommit = snapshot?.commits[0]
  const selectedBranch = snapshot?.branches[0]
  const fetchedAt = snapshot
    ? new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(snapshot.fetchedAt))
    : t.notLoaded

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
    <main className="app-shell" data-theme={theme}>
      <nav className="topbar" aria-label={t.application}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            TB
          </span>
          <span>treebranch-mark</span>
        </div>
        <div className="topbar-meta">
          <span>{t.sourceLayer}</span>
          <span className={`status-pill status-${statusKey}`}>{t.status[statusKey]}</span>
          <label className="language-control" htmlFor="language">
            <span>{t.language}</span>
            <select
              id="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="theme-toggle"
            type="button"
            aria-label={theme === 'dark' ? t.useLightTheme : t.useDarkTheme}
            title={theme === 'dark' ? t.useLightTheme : t.useDarkTheme}
            onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <section className="workspace">
        <header className="hero">
          <div>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.title}</h1>
          </div>
          <div className="run-card">
            <span>{t.fetched}</span>
            <strong>{fetchedAt}</strong>
          </div>
        </header>

        <section className="control-panel" aria-label={t.repositoryControls}>
          <form className="repo-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="repository">
              <span>{t.repository}</span>
              <input
                id="repository"
                value={repositoryInput}
                onChange={(event) => setRepositoryInput(event.target.value)}
                placeholder="owner/repo"
              />
            </label>
            <label className="field branch-field" htmlFor="branch">
              <span>{t.branch}</span>
              <input
                id="branch"
                value={branchInput}
                onChange={(event) => setBranchInput(event.target.value)}
                placeholder="main"
              />
            </label>
            <button type="submit" disabled={isLoading}>
              {isLoading ? t.status.loading : t.loadSnapshot}
            </button>
          </form>
        </section>

        {error && (
          <section className="alert" role="alert">
            <strong>{t.requestFailed}</strong>
            <span>{error}</span>
          </section>
        )}

        <section className="snapshot" aria-label={t.snapshotSummary}>
          <dl className="metric-grid">
            <div>
              <dt>{t.repository}</dt>
              <dd>{snapshot?.repository.fullName ?? '--'}</dd>
            </div>
            <div>
              <dt>{t.branches}</dt>
              <dd>{snapshot?.branches.length ?? 0}</dd>
            </div>
            <div>
              <dt>{t.commits}</dt>
              <dd>{snapshot?.commits.length ?? 0}</dd>
            </div>
            <div>
              <dt>{t.contributors}</dt>
              <dd>{snapshot?.contributors.length ?? 0}</dd>
            </div>
            <div>
              <dt>{t.mergedPrs}</dt>
              <dd>{snapshot?.pullRequests.length ?? 0}</dd>
            </div>
          </dl>

          {snapshot ? (
            <>
              <div className="detail-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t.repository}</h2>
                    <a href={snapshot.repository.url} target="_blank" rel="noreferrer">
                      {t.open}
                    </a>
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>{t.owner}</dt>
                      <dd>{snapshot.repository.owner}</dd>
                    </div>
                    <div>
                      <dt>{t.defaultBranch}</dt>
                      <dd>{snapshot.repository.defaultBranch}</dd>
                    </div>
                    <div>
                      <dt>{t.stars}</dt>
                      <dd>{snapshot.repository.stars}</dd>
                    </div>
                  </dl>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t.branchHead}</h2>
                    {selectedBranch && (
                      <a href={selectedBranch.url} target="_blank" rel="noreferrer">
                        {t.open}
                      </a>
                    )}
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>{t.name}</dt>
                      <dd>{selectedBranch?.name ?? '--'}</dd>
                    </div>
                    <div>
                      <dt>{t.headSha}</dt>
                      <dd className="mono-value">{shortSha(selectedBranch?.headSha)}</dd>
                    </div>
                    <div>
                      <dt>{t.latestCommit}</dt>
                      <dd>{latestCommit?.message ?? '--'}</dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section className="json-panel">
                <div className="panel-heading">
                  <h2>{t.snapshotJson}</h2>
                  <span>{snapshot.source}</span>
                </div>
                <pre>{JSON.stringify(snapshot, null, 2)}</pre>
              </section>
            </>
          ) : (
            <section className="empty-panel">
              <div>
                <strong>{t.noSnapshot}</strong>
                <span>{t.waitingPayload}</span>
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}

function shortSha(sha: string | undefined): string {
  return sha ? sha.slice(0, 7) : '--'
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M21 14.2A8.4 8.4 0 0 1 9.8 3a7.4 7.4 0 1 0 11.2 11.2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default App
