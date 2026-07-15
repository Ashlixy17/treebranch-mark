import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import type { TimelineGrouping, TimelineSpacing } from './layout'
import { ForkTimelinePipeline } from './pipeline'
import type { ForkTimelineSettings } from './pipeline'
import {
  GitHubApiSource,
  GitHubRestClient,
  GitSourceError,
  MemoryCache,
  parseRepositoryInput,
} from './source'
import type {
  GitHubRateLimitStatus,
  GitPullRequestBranchLimit,
  GitSourceErrorCode,
  GitSourceInput,
  GitSourceSnapshot,
} from './source'
import type { MainNodeMode } from './graph'
import { formatSourceError } from './ui/sourceErrorMessages'
import type { SourceErrorMessages } from './ui/sourceErrorMessages'
import { SvgPreviewPanel } from './ui/SvgPreviewPanel'

type Language = 'en' | 'zh-CN' | 'ja'
type StatusKey = 'idle' | 'loading' | 'error' | 'ready'
type Theme = 'light' | 'dark'
export const GITHUB_TOKEN_STORAGE_KEY = 'treebranch.github.token'

interface GenerationPlan {
  repository: string
  branch: string
  apiCalls: string[]
}

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
  timelineGrouping: string
  timelineGroupingYear: string
  timelineGroupingMonth: string
  timelineGroupingDay: string
  timelineSpacing: string
  timelineSpacingEqual: string
  timelineSpacingTime: string
  graphSettings: string
  mainNodeType: string
  mainNodeTypeCommit: string
  mainNodeTypeRelease: string
  mainNodeTypeTag: string
  includeOpenPullRequests: string
  pullRequestBranches: string
  partialData: string
  generateGraph: string
  preflightRepository: string
  confirmGenerateGraph: string
  generationPlan: string
  plannedApiCalls: string
  preflightHint: string
  largeDataWarning: string
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
  svgZoomControls: string
  zoomOutSvg: string
  zoomInSvg: string
  resetSvgZoom: string
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
    timelineGrouping: 'Timeline grouping',
    timelineGroupingYear: 'Year',
    timelineGroupingMonth: 'Month',
    timelineGroupingDay: 'Day',
    timelineSpacing: 'Horizontal spacing',
    timelineSpacingEqual: 'Equal spacing',
    timelineSpacingTime: 'Time-based spacing',
    graphSettings: 'Graph Settings',
    mainNodeType: 'Main node type',
    mainNodeTypeCommit: 'Commit',
    mainNodeTypeRelease: 'Release',
    mainNodeTypeTag: 'Tag',
    includeOpenPullRequests: 'Include open PR branches',
    pullRequestBranches: 'PR branches',
    partialData: 'Some data is partial',
    generateGraph: 'Generate SVG',
    preflightRepository: 'Check repository',
    confirmGenerateGraph: 'Confirm and generate SVG',
    generationPlan: 'Generation plan',
    plannedApiCalls: 'Planned API calls',
    preflightHint: 'Review the selected repository, graph settings, and API calls before generating.',
    largeDataWarning: 'Large repositories may exceed API page limits. Some commits or pull-request histories may be truncated.',
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
    svgZoomControls: 'SVG preview controls',
    zoomOutSvg: 'Zoom out SVG preview',
    zoomInSvg: 'Zoom in SVG preview',
    resetSvgZoom: 'Reset SVG preview zoom',
    errorMessages: {
      'not-found': 'Repository was not found or is not public.',
      'rate-limited': 'GitHub API rate limit exceeded. Configure a Personal Access Token or try again later.',
      'network-error': 'Network request failed. Please check your connection.',
      'unsupported-source': 'This source is not supported yet.',
      'bad-credentials': 'Authentication failed. Please verify your GitHub Personal Access Token.',
      'git-not-installed': 'Git is not installed or is not available on PATH.',
      'not-a-repository': 'The selected path is not a Git repository.',
      'permission-denied': 'The repository path cannot be accessed.',
      'git-command-failed': 'Git could not read the local repository.',
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
    timelineGrouping: '时间轴分组',
    timelineGroupingYear: '年',
    timelineGroupingMonth: '月',
    timelineGroupingDay: '日',
    timelineSpacing: '横向间距',
    timelineSpacingEqual: '等距输出',
    timelineSpacingTime: '按时间间距',
    graphSettings: '图形设置',
    mainNodeType: '主干节点类型',
    mainNodeTypeCommit: '提交',
    mainNodeTypeRelease: 'Release',
    mainNodeTypeTag: 'Tag',
    includeOpenPullRequests: '包含开放 PR 分支',
    pullRequestBranches: 'PR 分支数量',
    partialData: '部分数据未完整加载',
    generateGraph: '生成 SVG',
    preflightRepository: '检查仓库',
    confirmGenerateGraph: '确认并生成 SVG',
    generationPlan: '生成计划',
    plannedApiCalls: '计划调用的 API',
    preflightHint: '请先检查仓库、图形设置和 API 调用，确认后再生成。',
    largeDataWarning: '大型仓库可能超过 API 分页限制，部分提交或 PR 历史可能被截断。',
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
    svgZoomControls: 'SVG 预览控制',
    zoomOutSvg: '缩小 SVG 预览',
    zoomInSvg: '放大 SVG 预览',
    resetSvgZoom: '重置 SVG 预览缩放',
    errorMessages: {
      'not-found': '仓库不存在，或该仓库不是公开仓库。',
      'rate-limited': 'GitHub API 已达到限额，可配置 Personal Access Token 后重试。',
      'network-error': '网络请求失败，请检查网络连接。',
      'unsupported-source': '当前还不支持该数据源。',
      'bad-credentials': 'GitHub Token 无效，请检查后重试。',
      'git-not-installed': '未安装 Git，或无法从 PATH 中找到 Git。',
      'not-a-repository': '所选路径不是 Git 仓库。',
      'permission-denied': '无法访问该仓库路径。',
      'git-command-failed': 'Git 无法读取本地仓库。',
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
    timelineGrouping: 'タイムラインのグループ化',
    timelineGroupingYear: '年',
    timelineGroupingMonth: '月',
    timelineGroupingDay: '日',
    timelineSpacing: '横方向の間隔',
    timelineSpacingEqual: '等間隔',
    timelineSpacingTime: '時間間隔',
    graphSettings: 'グラフ設定',
    mainNodeType: 'メインノード種別',
    mainNodeTypeCommit: 'コミット',
    mainNodeTypeRelease: 'リリース',
    mainNodeTypeTag: 'タグ',
    includeOpenPullRequests: 'オープン PR ブランチを含める',
    pullRequestBranches: 'PR ブランチ数',
    partialData: '一部のデータが未完了です',
    generateGraph: 'SVG を生成',
    preflightRepository: 'リポジトリを確認',
    confirmGenerateGraph: '確認して SVG を生成',
    generationPlan: '生成プラン',
    plannedApiCalls: '予定する API 呼び出し',
    preflightHint: 'リポジトリ、設定、API 呼び出しを確認してから生成してください。',
    largeDataWarning: '大規模なリポジトリでは API ページ制限により、コミットや PR 履歴が切り詰められる場合があります。',
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
    svgZoomControls: 'SVG プレビュー操作',
    zoomOutSvg: 'SVG プレビューを縮小',
    zoomInSvg: 'SVG プレビューを拡大',
    resetSvgZoom: 'SVG プレビューのズームをリセット',
    errorMessages: {
      'not-found': 'リポジトリが見つからないか、公開リポジトリではありません。',
      'rate-limited': 'GitHub API のレート制限に達しました。Personal Access Token を設定して再試行してください。',
      'network-error': 'ネットワーク要求に失敗しました。接続を確認してください。',
      'unsupported-source': 'このデータソースはまだサポートされていません。',
      'bad-credentials': 'GitHub Token が無効です。確認してから再試行してください。',
      'git-not-installed': 'Git がインストールされていないか、PATH から見つかりません。',
      'not-a-repository': '選択したパスは Git リポジトリではありません。',
      'permission-denied': 'リポジトリのパスにアクセスできません。',
      'git-command-failed': 'Git がローカルリポジトリを読み取れませんでした。',
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
  const [timelineGrouping, setTimelineGrouping] = useState<TimelineGrouping>('month')
  const [timelineSpacing, setTimelineSpacing] = useState<TimelineSpacing>('equal')
  const [mainNodeMode, setMainNodeMode] = useState<MainNodeMode>('commit')
  const [includeOpenPullRequests, setIncludeOpenPullRequests] = useState(false)
  const [pullRequestLimit, setPullRequestLimit] = useState<GitPullRequestBranchLimit>(20)
  const [snapshot, setSnapshot] = useState<GitSourceSnapshot | null>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<Array<{ message: string; pullRequestNumber?: number }>>([])
  const [rateLimitStatus, setRateLimitStatus] = useState<GitHubRateLimitStatus | null>(null)
  const [errorCode, setErrorCode] = useState<GitSourceErrorCode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [generationPlan, setGenerationPlan] = useState<GenerationPlan | null>(null)
  const [snapshotCache] = useState(() => new MemoryCache<GitSourceSnapshot>())
  const pipelineRef = useRef<ForkTimelinePipeline<GitSourceInput> | null>(null)
  const sourceRef = useRef<GitHubApiSource | null>(null)
  const sourceInputRef = useRef<GitSourceInput | null>(null)
  const t = translations[language]
  const statusKey: StatusKey = isLoading ? 'loading' : errorCode ? 'error' : snapshot ? 'ready' : 'idle'
  const latestCommit = snapshot?.commits[0]
  const selectedBranch = snapshot?.branches.find((branch) => branch.name === branchInput) ??
    snapshot?.branches[0]
  const errorMessage = errorCode ? formatSourceError(errorCode, t.errorMessages) : null
  const apiAuthentication = rateLimitStatus
    ? rateLimitStatus.authentication === 'authenticated'
      ? t.authenticated
      : t.anonymous
    : t.unknownRateLimit
  const apiRemaining = rateLimitStatus && rateLimitStatus.remaining !== null && rateLimitStatus.limit !== null
      ? `${t.remaining}: ${rateLimitStatus.remaining} / ${rateLimitStatus.limit}`
      : null
  const apiRemainingPercent = rateLimitStatus && rateLimitStatus.remaining !== null && rateLimitStatus.limit
    ? Math.max(0, Math.min(100, (rateLimitStatus.remaining / rateLimitStatus.limit) * 100))
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

  function invalidatePreflight(clearSnapshot = false) {
    if (!awaitingConfirmation) {
      return
    }

    setAwaitingConfirmation(false)
    setGenerationPlan(null)
    setSvg(null)
    if (clearSnapshot) {
      setSnapshot(null)
      setWarnings([])
    }
  }

  function handleTokenChange(value: string) {
    setGithubToken(value)
    invalidatePreflight(true)

    const trimmed = value.trim()

    if (trimmed) {
      window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, trimmed)
    } else {
      window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY)
    }
  }

  function handleTimelineGroupingChange(grouping: TimelineGrouping) {
    setTimelineGrouping(grouping)
    if (awaitingConfirmation) {
      setAwaitingConfirmation(false)
      setGenerationPlan(null)
      setSvg(null)
      return
    }
    redraw({ ...currentSettings(), grouping })
  }

  function handleMainNodeModeChange(mainNodeMode: MainNodeMode) {
    setMainNodeMode(mainNodeMode)
    if (awaitingConfirmation) {
      setAwaitingConfirmation(false)
      setGenerationPlan(null)
      setSvg(null)
      return
    }
    redraw({ ...currentSettings(), mainNodeMode })
  }

  function handleTimelineSpacingChange(spacing: TimelineSpacing) {
    setTimelineSpacing(spacing)
    if (awaitingConfirmation) {
      setAwaitingConfirmation(false)
      setGenerationPlan(null)
      setSvg(null)
      return
    }
    redraw({ ...currentSettings(), spacing })
  }

  function handleIncludeOpenPullRequestsChange(includeOpenPullRequests: boolean) {
    setIncludeOpenPullRequests(includeOpenPullRequests)
    if (awaitingConfirmation) {
      setAwaitingConfirmation(false)
      setGenerationPlan(null)
      setSvg(null)
      return
    }
    redraw({ ...currentSettings(), includeOpenPullRequests })
  }

  async function handlePullRequestLimitChange(nextLimit: GitPullRequestBranchLimit) {
    setPullRequestLimit(nextLimit)

    if (awaitingConfirmation) {
      setAwaitingConfirmation(false)
      setGenerationPlan(null)
      setSvg(null)
      return
    }

    if (!snapshot || !sourceInputRef.current || !pipelineRef.current || nextLimit <= snapshot.pullRequestCapacity.requested) {
      redraw({ ...currentSettings(), pullRequestLimit: nextLimit })
      return
    }

    setIsEnriching(true)
    try {
      const input: GitSourceInput = {
        ...sourceInputRef.current,
        options: {
          ...sourceInputRef.current.options,
          pullRequestBranchLimit: nextLimit,
        },
      }
      const result = await pipelineRef.current.render(input, {
        ...currentSettings(),
        pullRequestLimit: nextLimit,
      })
      setSnapshot(result.snapshot)
      setSvg(result.svg)
      setWarnings(result.warnings)
      setRateLimitStatus(sourceRef.current?.getRateLimitStatus() ?? rateLimitStatus)
    } catch (caughtError) {
      if (caughtError instanceof GitSourceError) {
        setErrorCode(caughtError.code)
      } else {
        setErrorCode('unknown')
      }
    } finally {
      setIsEnriching(false)
    }
  }

  function currentSettings(): ForkTimelineSettings {
    return {
      grouping: timelineGrouping,
      spacing: timelineSpacing,
      mainNodeMode,
      includeOpenPullRequests,
      pullRequestLimit,
    }
  }

  function sourceInput(
    includePullRequestCommits: boolean,
    branch: string | null | undefined = branchInput.trim() || undefined,
    includeCommits = true,
    includeGraphMetadata = true,
  ): GitSourceInput {
    const repository = parseRepositoryInput(repositoryInput)
    const resolvedBranch = branch === null ? undefined : branch
    return {
      ...repository,
      branch: resolvedBranch,
      options: {
        maxCommitsPerBranch: 100,
        includeCommits,
        includeContributors: true,
        includePullRequests: true,
        includePullRequestCommits,
        includeReleases: includeGraphMetadata && mainNodeMode !== 'commit',
        includeTags: includeGraphMetadata && mainNodeMode !== 'commit',
        pullRequestBranchLimit: pullRequestLimit,
      },
    }
  }

  function planFor(input: GitSourceInput, includePullRequestCommits: boolean): GenerationPlan {
    const branch = input.branch ?? 'default branch'
    const apiCalls = [
      'GET /repos/' + input.owner + '/' + input.repo,
      'GET /repos/' + input.owner + '/' + input.repo + '/branches',
      'GET /repos/' + input.owner + '/' + input.repo + '/commits?sha=' + branch,
      'GET /repos/' + input.owner + '/' + input.repo + '/contributors',
      'GET /repos/' + input.owner + '/' + input.repo + '/pulls?state=all',
    ]

    if (input.options?.includeReleases) {
      apiCalls.push('GET /repos/' + input.owner + '/' + input.repo + '/releases')
    }
    if (input.options?.includeTags) {
      apiCalls.push('GET /repos/' + input.owner + '/' + input.repo + '/tags')
    }
    if (includePullRequestCommits) {
      const openText = includeOpenPullRequests ? 'merged + open' : 'merged'
      apiCalls.push(
        'GET /repos/' + input.owner + '/' + input.repo + '/pulls/{number}/commits (' +
          openText + ', up to ' + pullRequestLimit + ' each)',
      )
    }

    return {
      repository: input.owner + '/' + input.repo,
      branch,
      apiCalls,
    }
  }

  function redraw(settings: ForkTimelineSettings) {
    if (!snapshot || !pipelineRef.current) {
      return
    }

    const result = pipelineRef.current.renderSnapshot(snapshot, settings)
    setSvg(result.svg)
    setWarnings(result.warnings)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrorCode(null)
    setSnapshot(null)
    setSvg(null)
    setWarnings([])
    setAwaitingConfirmation(false)
    setGenerationPlan(null)
    let source: GitHubApiSource | null = null

    try {
      source = new GitHubApiSource({
        client: new GitHubRestClient({
          token: githubToken,
        }),
        cache: snapshotCache,
      })
      const pipeline = new ForkTimelinePipeline<GitSourceInput>({
        source,
      })
      sourceRef.current = source
      pipelineRef.current = pipeline
      const input = sourceInput(false, null, false, false)
      sourceInputRef.current = input
      const previewSnapshot = await source.loadRepository(input)
      const resolvedBranch = previewSnapshot.branches.find(
        (branch) => branch.name === previewSnapshot.repository.defaultBranch,
      )?.name ?? previewSnapshot.branches[0]?.name

      setBranchInput(previewSnapshot.repository.defaultBranch)
      setSnapshot(previewSnapshot)
      setSvg(null)
      setWarnings(previewSnapshot.warnings.map((warning) => ({
        message: warning.message,
        pullRequestNumber: warning.pullRequestNumber,
      })))
      const plannedInput = {
        ...input,
        branch: previewSnapshot.repository.defaultBranch,
        options: {
          ...input.options,
          includeReleases: mainNodeMode !== 'commit',
          includeTags: mainNodeMode !== 'commit',
        },
      }
      setGenerationPlan({
        ...planFor(plannedInput, true),
        branch: resolvedBranch ?? input.branch ?? 'default branch',
      })
      setAwaitingConfirmation(true)
      setRateLimitStatus(source.getRateLimitStatus() ?? rateLimitStatus)
    } catch (caughtError) {
      setRateLimitStatus(source?.getRateLimitStatus() ?? rateLimitStatus)

      if (caughtError instanceof GitSourceError) {
        setErrorCode(caughtError.code)
      } else {
        setErrorCode('unknown')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleConfirmGeneration() {
    if (!sourceRef.current || !pipelineRef.current || !sourceInputRef.current) {
      return
    }

    setIsLoading(true)
    setErrorCode(null)

    try {
      const input: GitSourceInput = {
        ...sourceInputRef.current,
        branch: branchInput.trim() || sourceInputRef.current.branch,
        options: {
          ...sourceInputRef.current.options,
          includeCommits: true,
          includePullRequestCommits: true,
          includeReleases: mainNodeMode !== 'commit',
          includeTags: mainNodeMode !== 'commit',
        },
      }
      sourceInputRef.current = input
      const result = await pipelineRef.current.render(input, currentSettings())

      setSnapshot(result.snapshot)
      setSvg(result.svg)
      setWarnings(result.warnings)
      setAwaitingConfirmation(false)
      setGenerationPlan(null)
      setRateLimitStatus(sourceRef.current.getRateLimitStatus() ?? rateLimitStatus)
    } catch (caughtError) {
      setRateLimitStatus(sourceRef.current.getRateLimitStatus() ?? rateLimitStatus)

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
              {apiRemainingPercent !== null && (
                <div
                  className="api-progress"
                  role="progressbar"
                  aria-label={apiRemaining ?? t.apiStatus}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(apiRemainingPercent)}
                >
                  <span style={{ width: `${apiRemainingPercent}%` }} />
                </div>
              )}
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
                onChange={(event) => {
                  setRepositoryInput(event.target.value)
                  invalidatePreflight(true)
                }}
                placeholder="owner/repo"
              />
            </label>
            <button type="submit" disabled={isLoading}>
              {isLoading ? t.status.loading : t.preflightRepository}
            </button>
          </form>
        </section>

        <section className="control-panel graph-settings-panel" aria-label={t.graphSettings}>
          <div className="panel-heading graph-settings-heading">
            <h2>{t.graphSettings}</h2>
            {isEnriching && <span>{t.status.loading}</span>}
          </div>
          <div className="graph-settings-grid">
            <label className="field grouping-field" htmlFor="timeline-grouping">
              <span>{t.timelineGrouping}</span>
              <select
                id="timeline-grouping"
                value={timelineGrouping}
                disabled={isLoading}
                onChange={(event) =>
                  handleTimelineGroupingChange(event.target.value as TimelineGrouping)
                }
              >
                <option value="year">{t.timelineGroupingYear}</option>
                <option value="month">{t.timelineGroupingMonth}</option>
                <option value="day">{t.timelineGroupingDay}</option>
              </select>
            </label>
            <label className="field" htmlFor="timeline-spacing">
              <span>{t.timelineSpacing}</span>
              <select
                id="timeline-spacing"
                value={timelineSpacing}
                disabled={isLoading}
                onChange={(event) =>
                  handleTimelineSpacingChange(event.target.value as TimelineSpacing)
                }
              >
                <option value="equal">{t.timelineSpacingEqual}</option>
                <option value="time">{t.timelineSpacingTime}</option>
              </select>
            </label>
            <label className="field" htmlFor="main-node-type">
              <span>{t.mainNodeType}</span>
              <select
                id="main-node-type"
                value={mainNodeMode}
                disabled={isLoading}
                onChange={(event) => handleMainNodeModeChange(event.target.value as MainNodeMode)}
              >
                <option value="commit">{t.mainNodeTypeCommit}</option>
                <option value="release">{t.mainNodeTypeRelease}</option>
                <option value="tag">{t.mainNodeTypeTag}</option>
              </select>
            </label>
            <label className="field checkbox-field" htmlFor="include-open-prs">
              <span>{t.includeOpenPullRequests}</span>
              <input
                id="include-open-prs"
                type="checkbox"
                checked={includeOpenPullRequests}
                disabled={isLoading}
                onChange={(event) => handleIncludeOpenPullRequestsChange(event.target.checked)}
              />
            </label>
            <label className="field" htmlFor="pull-request-limit">
              <span>{t.pullRequestBranches}</span>
              <select
                id="pull-request-limit"
                value={pullRequestLimit}
                disabled={isLoading || isEnriching}
                onChange={(event) =>
                  void handlePullRequestLimitChange(Number(event.target.value) as GitPullRequestBranchLimit)
                }
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
          <div className="data-risk-warning" role="note">
            <strong>⚠</strong>
            <span>{t.largeDataWarning}</span>
          </div>
        </section>

        {generationPlan && awaitingConfirmation && (
          <section className="generation-plan" aria-label={t.generationPlan}>
            <div className="panel-heading">
              <h2>{t.generationPlan}</h2>
              <span>{t.preflightHint}</span>
            </div>
            <dl className="generation-plan-summary">
              <div>
                <dt>{t.repository}</dt>
                <dd>{generationPlan.repository}</dd>
              </div>
              <div>
                <dt>{t.branch}</dt>
                <dd>
                  <select
                    id="generation-branch"
                    value={branchInput}
                    onChange={(event) => {
                      const nextBranch = event.target.value
                      setBranchInput(nextBranch)
                      if (sourceInputRef.current) {
                        setGenerationPlan(planFor({
                          ...sourceInputRef.current,
                          branch: nextBranch,
                          options: {
                            ...sourceInputRef.current.options,
                            includeReleases: mainNodeMode !== 'commit',
                            includeTags: mainNodeMode !== 'commit',
                          },
                        }, true))
                      }
                    }}
                  >
                    {snapshot?.branches.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
            </dl>
            <div className="planned-api-calls">
              <strong>{t.plannedApiCalls}</strong>
              <ul>
                {generationPlan.apiCalls.map((apiCall) => (
                  <li key={apiCall}>{apiCall}</li>
                ))}
              </ul>
            </div>
            <button
              className="confirm-generation-button"
              type="button"
              disabled={isLoading}
              onClick={() => void handleConfirmGeneration()}
            >
              {isLoading ? t.status.loading : t.confirmGenerateGraph}
            </button>
          </section>
        )}

        {errorMessage && (
          <section className="alert" role="alert">
            <strong>{t.requestFailed}</strong>
            <span>{errorMessage}</span>
          </section>
        )}

        {warnings.length > 0 && (
          <section className="alert warning-alert" role="status">
            <strong>{t.partialData}</strong>
            <details>
              <summary>{warnings.length}</summary>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={`${warning.pullRequestNumber ?? 'global'}-${index}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            </details>
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
              <dd>{snapshot?.pullRequests.filter((pullRequest) => pullRequest.state === 'merged').length ?? 0}</dd>
            </div>
          </dl>

          {snapshot ? (
            <>
              <div className="detail-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t.repository}</h2>
                    {snapshot.repository.url && (
                      <a href={snapshot.repository.url} target="_blank" rel="noreferrer">
                        {t.open}
                      </a>
                    )}
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>{t.owner}</dt>
                      <dd>{snapshot.repository.owner ?? '--'}</dd>
                    </div>
                    <div>
                      <dt>{t.defaultBranch}</dt>
                      <dd>{snapshot.repository.defaultBranch}</dd>
                    </div>
                    <div>
                      <dt>{t.stars}</dt>
                      <dd>{snapshot.repository.stars ?? '--'}</dd>
                    </div>
                  </dl>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t.branchHead}</h2>
                    {selectedBranch?.url && (
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

              <SvgPreviewPanel
                svg={svg}
                title={t.graphPreview}
                emptyTitle={t.noGraph}
                emptyDescription={t.waitingGraph}
                zoomControlsLabel={t.svgZoomControls}
                zoomOutLabel={t.zoomOutSvg}
                zoomInLabel={t.zoomInSvg}
                resetZoomLabel={t.resetSvgZoom}
              />

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
