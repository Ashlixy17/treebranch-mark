# treebranch-mark

一个用于可视化 GitHub 项目分支演进和协作历程的 Web 工具。

treebranch-mark 的目标是做一个项目历史可视化工具：用户输入公开 GitHub 仓库后，应用会读取仓库的分支、提交、贡献者和已合并 PR，并逐步构建出可交互的 Branch Graph。

当前项目还处在 MVP 的第一阶段：**Source Layer**。

## 项目目标

- 通过输入仓库地址生成直观的项目历史可视化结果。
- 以时间线和分支树的方式展示项目共建历程。
- 支持从多种来源读取 Git 数据：
  - GitHub API
  - 本地 Git
  - GitLab
- 将数据采集、解析、图构建、布局和渲染拆成清晰的流水线。

## 当前进度

已完成：

- React + Vite + TypeScript 项目基础结构
- Source 层接口设计
- GitHub API 数据源适配器
- GitHub REST client
- 统一的 Git Source Snapshot 数据结构
- Source 层单元测试
- 最小调试 UI

暂未完成：

- Parser
- Commit DAG 构建
- Branch Graph 构建
- Layout
- Renderer
- GitLab 数据源
- 本地 Git 数据源

## 架构

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
   |
   v
Renderer
```

## Source Layer

Source 层只负责三件事：

1. 获取数据
2. 标准化数据
3. 输出 Snapshot

Source 层不会做：

- Graph 构建
- Commit DAG 推导
- Branch 可达性分析
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

Commit 不保存 `branchNames`、`reachableBranches`、`depth`、`layoutX`、`layoutY` 等派生字段。后续 Parser 会根据 `GitBranch.headSha` 和 `GitCommit.parents` 推导每个分支可达的提交集合。

## GitHub API 数据源

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

## 测试

当前测试覆盖：

- GitHub API 响应映射
- `options.maxCommitsPerBranch` 默认值和覆盖值
- branch 到 `{ name, headSha }` 的映射
- commit 按 `sha` 去重
- commit 不保存 branch 归属信息
- `404`、rate limit、网络错误映射
- `owner/repo` 和 GitHub URL 输入解析

运行：

```bash
npm test
```

## 目录结构

```text
src/
  source/
    types.ts
    index.ts
    types.test.ts
    github/
      GitHubApiSource.ts
      GitHubApiSource.test.ts
      githubRestClient.ts
```

## 路线图

- [x] Source Layer
- [x] GitHub API Source
- [ ] Snapshot 序列化测试
- [ ] Parser: 构建 Commit DAG
- [ ] Graph Builder: 构建 Branch Graph
- [ ] Layout: 计算分支和提交节点位置
- [ ] Renderer: 渲染可交互分支图
- [ ] GitHub Token 支持
- [ ] GitLab Source
- [ ] Local Git Source
- [ ] Snapshot 缓存
- [ ] SVG/PNG 导出

## 设计约束

- Source 层只输出可序列化的普通数据对象。
- Branch 是指向 Commit 的引用，不是 Commit 的属性。
- Commit 不知道自己属于哪个 Branch。
- Graph、Layout、Renderer 的派生字段不进入 Source 模型。
- 第一版优先保证数据边界清晰，再逐步进入可视化实现。
