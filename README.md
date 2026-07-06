# treebranch-mark

treebranch-mark 是一个用于可视化 GitHub 项目分支演进和协作历程的 Web 工具。

项目目标是把 Git 仓库历史拆成清晰的数据流水线：先从数据源读取统一快照，再解析 Commit DAG，后续继续构建 Branch Graph、时间线布局和 SVG 渲染。

## 当前状态

当前项目处于 MVP 早期阶段，已完成：

- React + Vite + TypeScript 项目基础结构
- Source Layer
- GitHub API Source
- Git Source Snapshot 数据模型
- Commit Parser MVP
- Parser Review 与补充测试
- Source Snapshot 调试页面
- 英语、简体中文、日语语言切换
- 浅色 / 暗夜模式切换
- 项目图标与基础品牌信息

下一阶段：

- Step 3：Graph Builder 架构设计
- 根据 `CommitGraph` 构建 Branch Graph

## 架构路线

```text
GitHub API
Local Git
GitLab
   |
   v
Source
统一 Git 数据
   |
   v
Parser
构建 Commit DAG
   |
   v
Graph Builder
构建 Branch Graph
   |
   v
Layout
Tree / Timeline
   |
   v
Renderer
SVG
```

## Source Layer

Source 层已经完成第一版，并进入冻结状态。除 Bug 修复外，后续不再扩展 Source 功能，主要精力转向 Parser 和 Graph Builder。

Source 只负责：

1. 获取数据
2. 标准化数据
3. 输出 `GitSourceSnapshot`

Source 不负责：

- Commit DAG 构建
- Branch 可达性分析
- Branch Graph 构建
- Layout 坐标计算
- Renderer 节点生成

### 核心接口

```ts
interface GitSource {
  kind: 'github-api' | 'local-git' | 'gitlab'
  loadRepository(input: GitSourceInput): Promise<GitSourceSnapshot>
}

interface GitSourceInput {
  owner: string
  repo: string
  branch?: string
  options?: GitSourceOptions
}

interface GitSourceOptions {
  maxCommitsPerBranch?: number
  includePullRequests?: boolean
  includeContributors?: boolean
  includeTags?: boolean
  cache?: 'default' | 'reload' | 'no-store'
}
```

### 数据模型原则

`GitBranch` 只表示分支引用：

```ts
interface GitBranch {
  name: string
  headSha: string
  isDefault: boolean
  url: string
}
```

`GitCommit` 只保存 Git 原始信息：

```ts
interface GitCommit {
  sha: string
  parents: string[]
  message: string
  author: GitIdentity
  committer: GitIdentity
  authoredAt: string | null
  committedAt: string | null
  url: string
}
```

Commit 不保存 `branchNames`、`reachableBranches`、`depth`、`layoutX`、`layoutY` 等派生字段。后续阶段会根据 `GitBranch.headSha` 和 `GitCommit.parents` 推导分支可达关系。

## GitHub API Source

当前第一版实现了 `GitHubApiSource`，运行在浏览器前端，直接调用公开 GitHub REST API。

目前读取的数据包括：

- repository metadata
- branches
- commits by branch
- contributors
- closed pull requests，并过滤出已合并 PR

第一版限制：

- 只支持公开仓库
- 不处理 GitHub Token
- 不做深度分页
- 默认每个 branch 最多读取 100 个 commits
- GitHub 匿名 API 可能触发 rate limit

## Commit Parser

Commit Parser MVP 已完成。

Parser 输入：

```ts
GitSourceSnapshot
```

Parser 输出：

```ts
interface CommitGraph {
  nodes: Map<string, CommitNode>
  roots: CommitNode[]
}

interface CommitNode {
  commit: GitCommit
  parents: CommitNode[]
  children: CommitNode[]
}

interface ParserResult {
  graph: CommitGraph
  warnings: ParserWarning[]
}
```

Parser 负责：

- 建立 `sha -> CommitNode` 索引
- 根据 `GitCommit.parents` 建立 parent 边
- 反向建立 children 边
- 找到 root commits
- 对 Missing Parent 和重复 SHA 返回 warnings

Parser 不负责：

- Branch 可达关系
- Branch Graph
- Layout
- Timeline
- SVG
- Renderer

## 前端调试页面

当前页面是 Source Snapshot Console，用于验证数据源和 Parser 之前的数据质量。

已支持：

- 输入 `owner/repo`
- 输入指定 branch
- 加载公开 GitHub 仓库快照
- 展示 repository、branches、commits、contributors、merged PRs 数量
- 展示标准化后的 JSON Snapshot
- 英语、简体中文、日语切换
- 浅色 / 暗夜模式切换

当前页面仍是开发调试界面，不是最终可视化 Renderer。

## 快速开始

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

打开浏览器访问：

```text
http://127.0.0.1:5173
```

默认输入示例：

```text
vuejs/core
```

也支持 GitHub 仓库 URL：

```text
https://github.com/vuejs/core
```

## 部署状态

当前代码已经可以本地运行和生产构建。

GitHub Pages 自动部署尚未配置，所以仓库上传后不会自动生成线上网站。后续可以添加 GitHub Actions，将 `main` 分支构建产物发布到 Pages。

## 可用脚本

```bash
npm run dev
```

启动本地开发服务器。

```bash
npm run build
```

执行 TypeScript 检查并构建生产版本。

```bash
npm run lint
```

运行 Oxlint。

```bash
npm test
```

运行 Vitest 单元测试。

```bash
npm run preview
```

预览生产构建结果。

## 测试覆盖

当前测试覆盖：

- GitHub API 响应映射
- `options.maxCommitsPerBranch` 默认值和覆盖值
- branch 到 `{ name, headSha }` 的映射
- commit 按 `sha` 去重
- commit 不保存 branch 归属信息
- `404`、rate limit、网络错误映射
- `owner/repo` 和 GitHub URL 输入解析
- 线性 Commit 历史解析
- Merge Commit 多 parent 解析
- children 反向关系建立
- Missing Parent warning
- 重复 SHA warning
- Empty Repository
- Parser 不修改 Source Snapshot

运行：

```bash
npm test
```

## 目录结构

```text
src/
  parser/
    CommitParser.ts
    CommitParser.test.ts
    index.ts
    types.ts
  source/
    types.ts
    index.ts
    types.test.ts
    github/
      GitHubApiSource.ts
      GitHubApiSource.test.ts
      githubRestClient.ts
  App.tsx
  App.css
  index.css
```

## 路线图

- [x] Source Layer
- [x] GitHub API Source
- [ ] Snapshot 序列化测试
- [x] Commit Parser MVP
- [x] Parser Review
- [ ] Graph Builder Architecture Design
- [ ] Graph Builder Implementation
- [ ] Layout: Tree / Timeline
- [ ] Renderer: SVG
- [ ] Theme / Animation
- [ ] GitHub Pages / GitHub Action 部署
- [ ] GitHub Token 支持
- [ ] GitLab Source
- [ ] Local Git Source
- [ ] Snapshot 缓存
- [ ] SVG/PNG 导出
- [ ] VSCode Plugin

## 开发流程

项目采用简单的 Git Flow：

- `main` 保持稳定版本
- `dev` 用于日常开发
- 每完成一个阶段后，从 `dev` 合并到 `main`

当前阶段状态：

```text
Step 1  Source Layer      done
Step 2  Commit Parser     done
Step 3  Graph Builder     next
Step 4  Layout            pending
Step 5  Renderer          pending
Step 6  Theme / Animation pending
Step 7  Plugin / Action   pending
```

## 设计约束

- Source 层只输出可序列化的普通数据对象。
- Branch 是指向 Commit 的引用，不是 Commit 的属性。
- Commit 不知道自己属于哪个 Branch。
- Parser 可以构建运行时图对象，但不能修改 Source Snapshot。
- Graph、Layout、Renderer 的派生字段不进入 Source 模型。
- 每个阶段先明确接口和职责，再进入实现。
