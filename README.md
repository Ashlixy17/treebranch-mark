# Treebranch Mark

![GitHub Release](https://img.shields.io/github/v/release/Ashlixy17/treebranch-mark?include_prereleases)

Treebranch Mark 将 Git 仓库历史转换为可展示的分支 SVG 图。它既可以在浏览器中读取公开 GitHub 仓库，也可以通过 Node CLI 直接读取本地 `.git`，不受 GitHub API 限流影响。

```text
GitHub API ─┐
            ├─> GitSourceSnapshot -> Parser -> Graph -> Layout -> RenderModel -> SVG
Local Git ──┘
```

## Demo

![Treebranch Mark Avatar Commit Nodes Demo](docs/assets/v0.1.0-alpha-demo.png)

## 快速开始

### Browser Viewer

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`，输入公开 GitHub 仓库，例如：

```text
vuejs/core
```

浏览器支持可选 GitHub Personal Access Token、API 配额状态、浅色/暗夜模式，以及英语、简体中文、日语切换。

Timeline is the default graph layout. In the Browser Viewer, choose UTC year, month, or day grouping in Graph settings; changing it redraws the loaded graph without another repository request.

### Local Git CLI

环境要求：Node.js `>=20.19.0`，并且 Git 已加入 `PATH`。

```bash
npm install
npm run build
node dist-cli/treebranch.js render . --output branch.svg
```

也可以在仓库中建立本地命令链接：

```bash
npm link
treebranch render . --output branch.svg
```

CLI 参数：

```text
treebranch render <repository-path>
  -o, --output <file>       输出路径，默认 branch.svg
      --branch <name>       只读取指定本地分支
      --max-commits <count> 每个分支最多读取的 Commit 数，默认 100
  -h, --help                查看帮助
```

The Local Git CLI does not provide a Timeline grouping option.

示例：

```bash
treebranch render ./my-project --branch main --max-commits 200 --output docs/branch-history.svg
```

## 当前能力

- GitHub API Source：仓库、分支、Commit、贡献者和已合并 PR
- Local Git Source：本地分支、Commit、author、committer 和时间
- Commit DAG Parser 与 Branch Graph Builder
- 确定性的 Timeline Layout（默认）与 Tree Layout
- Renderer-neutral RenderModel
- standalone SVG Renderer
- GitHub 贡献者头像节点；本地 Git 无头像时回退为圆形节点
- Source 层 Memory Snapshot Cache
- Browser Viewer 与 Local Git CLI 共用同一个 RenderPipeline
- Source、Pipeline、Token 和构建边界自动化测试

当前版本基于已发布的 `v0.2.0`。Local Git Source、共享 RenderPipeline 与 CLI MVP 已发布；当前开发版本已实现 Timeline 并将其设为默认布局，Metro、动画和 GitHub Action 尚未实现。

## 架构

```text
Browser Viewer                 Local CLI
      |                            |
      v                            v
GitHubApiSource               LocalGitSource
      |                            |
      +------------+---------------+
                   |
                   v
           GitSourceSnapshot
                   |
                   v
             Commit Parser
                   |
                   v
             CommitGraph
                   |
                   v
          Branch Graph Builder
                   |
                   v
      Timeline Layout (default)
          or Tree Layout
                   |
                   v
              RenderModel
                   |
                   v
             SVG Renderer
```

`GitSourceSnapshot` 是所有数据源唯一的公共数据契约。Parser、Graph Builder、Layout、RenderModel 和 Renderer 不依赖 GitHub API、Git CLI、React 或具体 Source 实现。

<details>
<summary>展开查看分层架构与数据模型</summary>

### Source

不同 Source 使用独立输入，但统一输出 `GitSourceSnapshot`：

```ts
interface GitSource<TInput> {
  kind: 'github-api' | 'local-git' | 'gitlab'
  loadRepository(input: TInput): Promise<GitSourceSnapshot>
}

interface GitHubSourceInput {
  owner: string
  repo: string
  branch?: string
}

interface LocalGitSourceInput {
  repositoryPath: string
  branch?: string
  options?: {
    maxCommitsPerBranch?: number
  }
}
```

Source 只负责获取、标准化和错误映射，不构建 DAG、计算 branch 可达关系或生成布局。

本地 Source 通过参数数组调用系统 Git，不启用 shell，也不直接解析 `.git`。MVP 只读取 `refs/heads/*`，不包含 remote-tracking branches 和 tags。

### Git 数据模型

```ts
interface GitBranch {
  name: string
  headSha: string
  isDefault: boolean
  url: string | null
}

interface GitCommit {
  sha: string
  parents: string[]
  message: string
  author: GitIdentity
  committer: GitIdentity
  authoredAt: string | null
  committedAt: string | null
  url: string | null
}
```

Commit 不保存 `branchNames`、`reachableBranches`、`depth`、`layoutX` 或 `layoutY`。本地 Git 不包含平台头像，因此 `GitIdentity.avatarUrl` 明确为 `null`。

### Pipeline

Browser 和 CLI 只调用：

```ts
const result = await pipeline.render(input)
```

`RenderPipeline<TInput>` 只让输入类型跟随 Source。`GitSourceSnapshot`、Pipeline Result 和后续处理层保持固定类型。

### Parser、Graph 与 Layout

- Parser 将 Snapshot 转换为带 parents/children 的 `CommitGraph`
- Graph Builder 从 branch head 计算每个分支的可达 Commit 集合
- Timeline Layout 是默认布局，Tree Layout 仍然可用；两者只输出节点坐标和边，不包含 label、颜色或 SVG

### RenderModel 与 Renderer

- RenderModel 将纯布局数据转换为 Renderer 可消费的节点和边
- SVG Renderer 输出 `<line>`、`<circle>`、`<image>` 和 `<text>`
- Renderer 不执行 Graph 分析或 Layout

</details>

## 开发与验证

```bash
npm test
npm run build
npm run lint
```

`npm run build` 会分别生成：

```text
dist/                  Browser Viewer
dist-cli/treebranch.js Node CLI
```

构建过程会自动验证：

- Browser 与 CLI 产物目录互不覆盖
- CLI 保留 Node shebang
- Browser bundle 不包含 Node CLI 运行时代码
- 构建后的 CLI 能正确输出帮助信息

当前自动化测试覆盖 GitHub Source、Local Git Source、空仓库、多分支、Merge Commit、detached HEAD、裸仓库、Commit DAG、Branch Graph、Layout、RenderModel、SVG、Pipeline、CLI 和 Token 安全边界。

## 文档

- [Local Git Source Architecture Design](docs/superpowers/specs/2026-07-12-local-git-source-design.md)
- [ADR 0007: Local Git Source Boundary](docs/adr/0007-local-git-source.md)
- [v0.2.0 Release Note（中英双语）](docs/releases/v0.2.0.md)
- [v0.2.0 Release Checklist](docs/releases/v0.2.0-checklist.md)

<details>
<summary>展开查看全部 Architecture Decision Records</summary>

- [ADR 0001: Source Layer Boundary](docs/adr/0001-source-layer.md)
- [ADR 0002: Parser Boundary](docs/adr/0002-parser-boundary.md)
- [ADR 0003: LayoutResult Boundary](docs/adr/0003-layout-result.md)
- [ADR 0004: RenderModel Boundary](docs/adr/0004-render-model.md)
- [ADR 0005: GitHub Token Security](docs/adr/0005-token-security.md)
- [ADR 0006: Source Cache Boundary](docs/adr/0006-source-cache-boundary.md)
- [ADR 0007: Local Git Source Boundary](docs/adr/0007-local-git-source.md)

</details>

## Roadmap

- [x] GitHub API Source
- [x] Commit DAG Parser
- [x] Branch Graph Builder
- [x] Tree Layout
- [x] RenderModel
- [x] SVG Renderer
- [x] Browser Viewer
- [x] GitHub Token 与 Memory Snapshot Cache
- [x] Avatar Commit Nodes
- [x] Local Git Source
- [x] Local Git RenderPipeline
- [x] `treebranch render` CLI MVP
- [x] v0.2.0 Release Note 与 Release Checklist
- [x] v0.2.0 Release
- [x] Timeline Layout
- [ ] Metro Layout
- [ ] CLI package distribution
- [ ] GitHub Action
- [ ] GitLab / Gitea / Bitbucket Source
- [ ] VS Code Extension

## 开发流程

- `main` 保持稳定版本
- `dev` 用于日常开发
- 每个阶段按照 Architecture Design、Implementation、Review、Tests、Merge 的顺序推进
