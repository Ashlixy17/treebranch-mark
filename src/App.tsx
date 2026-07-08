import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { RenderPipeline } from './pipeline'
import { GitHubApiSource, GitHubRestClient, GitSourceError, parseRepositoryInput } from './source'
import type { GitHubRateLimitStatus, GitSourceErrorCode, GitSourceSnapshot } from './source'
import { formatSourceError } from './ui/sourceErrorMessages'
import type { SourceErrorMessages } from './ui/sourceErrorMessages'

type Language = 'en' | 'zh-CN' | 'ja'
type StatusKey = 'idle' | 'loading' | 'error' | 'ready'
type Theme = 'light' | 'dark'
export const GITHUB_TOKEN_STORAGE_KEY = 'treebranch.github.token'

interface Translation {
  application: string
  sourceLayer: string
  status: Record<StatusKey, string>
  language: string
  eyebrow: string
  title: string
  fetched: string
  notLoaded: string
  apiStatus: string
  authenticated: string
  anonymous: string
  remaining: string
  unknownRateLimit: string
  repositoryControls: string
  repository: string
  githubToken: string
  githubTokenHint: string
  branch: string
  generateGraph: string
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
  graphPreview: string
  noGraph: string
  waitingGraph: string
  snapshotJson: string
  noSnapshot: string
  waitingPayload: string
  useDarkTheme: string
  useLightTheme: string
  errorMessages: SourceErrorMessages
}

const languageOptions: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'ja', label: '日本語' },
]

const translations = {
  en: {
    application: 'Application',
    sourceLayer: 'Pipeline',
    status: {
      idle: 'Idle',
      loading: 'Loading',
      error: 'Error',
      ready: 'Ready',
    },
    language: 'Language',
    eyebrow: 'Git History Model',
    title: 'Branch graph viewer',
    fetched: 'Fetched',
    notLoaded: 'Not loaded',
    apiStatus: 'GitHub API Status',
    authenticated: 'Authenticated',
    anonymous: 'Anonymous',
    remaining: 'Remaining',
    unknownRateLimit: 'Unknown',
    repositoryControls: 'Repository controls',
    repository: 'Repository',
    githubToken: 'GitHub Token (Optional)',
    githubTokenHint: 'Stored locally and sent only to the GitHub API.',
    branch: 'Branch',
    generateGraph: 'Generate SVG',
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
    graphPreview: 'SVG graph preview',
    noGraph: 'No graph generated',
    waitingGraph: 'Run the pipeline to generate the first SVG graph.',
    snapshotJson: 'Snapshot JSON',
    noSnapshot: 'No snapshot loaded',
    waitingPayload: 'Waiting for normalized source payload.',
    useDarkTheme: 'Switch to dark mode',
    useLightTheme: 'Switch to light mode',
    errorMessages: {
      'not-found': 'Repository was not found or is not public.',
      'rate-limited': 'GitHub API rate limit exceeded. Configure a Personal Access Token or try again later.',
      'network-error': 'Network request failed. Please check your connection.',
      'unsupported-source': 'This source is not supported yet.',
      'bad-credentials': 'Authentication failed. Please verify your GitHub Personal Access Token.',
      unknown: 'Repository could not be loaded.',
    },
  },
  'zh-CN': {
    application: '应用',
    sourceLayer: 'Pipeline',
    status: {
      idle: '待机',
      loading: '加载中',
      error: '错误',
      ready: '就绪',
    },
    language: '语言',
    eyebrow: 'Git 历史模型',
    title: '分支图查看器',
    fetched: '获取时间',
    notLoaded: '尚未加载',
    apiStatus: 'GitHub API 状态',
    authenticated: '已认证',
    anonymous: '匿名',
    remaining: '剩余',
    unknownRateLimit: '未知',
    repositoryControls: '仓库控制',
    repository: '仓库',
    githubToken: 'GitHub Token（可选）',
    githubTokenHint: '仅保存在本地，并且只会发送给 GitHub API。',
    branch: '分支',
    generateGraph: '生成 SVG',
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
    graphPreview: 'SVG 图预览',
    noGraph: '尚未生成图',
    waitingGraph: '运行 Pipeline 后会生成第一张 SVG 图。',
    snapshotJson: '快照 JSON',
    noSnapshot: '暂无快照',
    waitingPayload: '等待标准化 Source 数据。',
    useDarkTheme: '切换到暗夜模式',
    useLightTheme: '切换到亮色模式',
    errorMessages: {
      'not-found': '仓库不存在，或该仓库不是公开仓库。',
      'rate-limited': 'GitHub API 已达到限额，可配置 Personal Access Token 后重试。',
      'network-error': '网络请求失败，请检查网络连接。',
      'unsupported-source': '当前还不支持该数据源。',
      'bad-credentials': 'GitHub Token 无效，请检查后重试。',
      unknown: '仓库无法加载，请检查输入后重试。',
    },
  },
  ja: {
    application: 'アプリケーション',
    sourceLayer: 'Pipeline',
    status: {
      idle: '待機中',
      loading: '読み込み中',
      error: 'エラー',
      ready: '準備完了',
    },
    language: '言語',
    eyebrow: 'Git 履歴モデル',
    title: 'ブランチグラフビューア',
    fetched: '取得日時',
    notLoaded: '未読み込み',
    apiStatus: 'GitHub API ステータス',
    authenticated: '認証済み',
    anonymous: '匿名',
    remaining: '残り',
    unknownRateLimit: '不明',
    repositoryControls: 'リポジトリ操作',
    repository: 'リポジトリ',
    githubToken: 'GitHub Token（任意）',
    githubTokenHint: 'ローカルに保存され、GitHub API にのみ送信されます。',
    branch: 'ブランチ',
    generateGraph: 'SVG を生成',
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
    graphPreview: 'SVG グラフプレビュー',
    noGraph: 'グラフはまだ生成されていません',
    waitingGraph: 'Pipeline を実行すると最初の SVG グラフが生成されます。',
    snapshotJson: 'スナップショット JSON',
    noSnapshot: 'スナップショット未読み込み',
    waitingPayload: '標準化された Source データを待っています。',
    useDarkTheme: 'ダークモードに切り替え',
    useLightTheme: 'ライトモードに切り替え',
    errorMessages: {
      'not-found': 'リポジトリが見つからないか、公開リポジトリではありません。',
      'rate-limited': 'GitHub API のレート制限に達しました。Personal Access Token を設定して再試行してください。',
      'network-error': 'ネットワーク要求に失敗しました。接続を確認してください。',
      'unsupported-source': 'このデータソースはまだサポートされていません。',
      'bad-credentials': 'GitHub Token が無効です。確認してから再試行してください。',
      unknown: 'リポジトリを読み込めませんでした。入力内容を確認して再試行してください。',
    },
  },
} satisfies Record<Language, Translation>

function App() {
  const [language, setLanguage] = useState<Language>('en')
  const [theme, setTheme] = useState<Theme>('light')
  const [repositoryInput, setRepositoryInput] = useState('vuejs/core')
  const [githubToken, setGithubToken] = useState('')
  const [branchInput, setBranchInput] = useState('main')
  const [snapshot, setSnapshot] = useState<GitSourceSnapshot | null>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [rateLimitStatus, setRateLimitStatus] = useState<GitHubRateLimitStatus | null>(null)
  const [errorCode, setErrorCode] = useState<GitSourceErrorCode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const t = translations[language]
  const statusKey: StatusKey = isLoading ? 'loading' : errorCode ? 'error' : snapshot ? 'ready' : 'idle'
  const latestCommit = snapshot?.commits[0]
  const selectedBranch = snapshot?.branches[0]
  const errorMessage = errorCode ? formatSourceError(errorCode, t.errorMessages) : null
  const apiAuthentication = rateLimitStatus
    ? rateLimitStatus.authentication === 'authenticated'
      ? t.authenticated
      : t.anonymous
    : t.unknownRateLimit
  const apiRemaining = rateLimitStatus && rateLimitStatus.remaining !== null && rateLimitStatus.limit !== null
      ? `${t.remaining}: ${rateLimitStatus.remaining} / ${rateLimitStatus.limit}`
      : null
  const fetchedAt = snapshot
    ? new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(snapshot.fetchedAt))
    : t.notLoaded

  useEffect(() => {
    const storedToken = window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY)

    if (storedToken) {
      setGithubToken(storedToken)
    }
  }, [])

  function handleTokenChange(value: string) {
    setGithubToken(value)

    const trimmed = value.trim()

    if (trimmed) {
      window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, trimmed)
    } else {
      window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrorCode(null)
    setSnapshot(null)
    setSvg(null)
    setRateLimitStatus(null)

    let source: GitHubApiSource | null = null

    try {
      source = new GitHubApiSource({
        client: new GitHubRestClient({
          token: githubToken,
        }),
      })
      const pipeline = new RenderPipeline({ source })
      const repository = parseRepositoryInput(repositoryInput)
      const result = await pipeline.render({
        ...repository,
        branch: branchInput.trim() || undefined,
        options: {
          maxCommitsPerBranch: 20,
          includeContributors: false,
          includePullRequests: false,
        },
      })

      setSnapshot(result.snapshot)
      setSvg(result.svg)
      setRateLimitStatus(source.getRateLimitStatus())
    } catch (caughtError) {
      setRateLimitStatus(source?.getRateLimitStatus() ?? null)

      if (caughtError instanceof GitSourceError) {
        setErrorCode(caughtError.code)
      } else {
        setErrorCode('unknown')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <nav className="topbar" aria-label={t.application}>
        <div className="brand">
          <img className="brand-mark" src="/treebranch-mark.ico" alt="" aria-hidden="true" />
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
          <div className="hero-cards">
            <div className="run-card">
              <span>{t.fetched}</span>
              <strong>{fetchedAt}</strong>
            </div>
            <div className="run-card api-card">
              <span>{t.apiStatus}</span>
              <strong>{apiAuthentication}</strong>
              {apiRemaining && <span>{apiRemaining}</span>}
            </div>
          </div>
        </header>

        <section className="control-panel" aria-label={t.repositoryControls}>
          <form className="repo-form" onSubmit={handleSubmit}>
            <label className="field token-field" htmlFor="github-token">
              <span>{t.githubToken}</span>
              <input
                id="github-token"
                type="password"
                value={githubToken}
                onChange={(event) => handleTokenChange(event.target.value)}
                placeholder="ghp_xxxxxxxxx"
                autoComplete="off"
              />
              <small>{t.githubTokenHint}</small>
            </label>
            <label className="field repo-field" htmlFor="repository">
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
              {isLoading ? t.status.loading : t.generateGraph}
            </button>
          </form>
        </section>

        {errorMessage && (
          <section className="alert" role="alert">
            <strong>{t.requestFailed}</strong>
            <span>{errorMessage}</span>
          </section>
        )}

        <section className="snapshot" aria-label={t.snapshotSummary}>
          <dl className="metric-grid">
            <div>
              <dt>{t.repository}</dt>
              <dd>{snapshot?.repository.name ?? '--'}</dd>
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

              <section className="svg-panel">
                <div className="panel-heading">
                  <h2>{t.graphPreview}</h2>
                  <span>svg</span>
                </div>
                {svg ? (
                  <div className="svg-preview" dangerouslySetInnerHTML={{ __html: svg }} />
                ) : (
                  <div className="svg-empty">
                    <strong>{t.noGraph}</strong>
                    <span>{t.waitingGraph}</span>
                  </div>
                )}
              </section>

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
