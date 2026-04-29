# 更新日志

wolf 所有显著变更记录在此。版本号遵循 [Semantic Versioning](https://semver.org/)
（`0.x` 例外：minor 升级到 `1.0` 之前可能包含 breaking change）。

## v0.1.0 — 2026-04-28

首个稳定版发布到 npm：`npm i -g @gerryt/wolf`。Tailor 流水线（分析师 +
简历 + 求职信 writer，3-agent 检查点流程）是唯一端到端可用的特性。
`hunt` / `score` / `fill` / `reach` 已注册但会打印清晰的"未实现"提示并退出。

### 新增
- npm 稳定包 `@gerryt/wolf` 通过 `package.stable.json` + `scripts/publish-stable.sh`
  发布（根 `package.json` 是 dev workspace 清单，永不发布）。
- Dev 二进制 `wolf-dev`（与稳定版 `wolf` 分离），dogfood 稳定版的同时
  可以在同一台机器上迭代 dev。
- `update-notifier` 集成 —— 稳定版用户在新 `@gerryt/wolf` 发布时看到
  一行提示（24h 缓存；不阻塞用户命令）。
- Typed errors：`MissingApiKeyError`（`MISSING_API_KEY`）和
  `MissingChromiumError`（`MISSING_CHROMIUM`）。CLI 渲染为单行 stderr +
  exit 1（无 stack trace）。MCP 工具 handler 序列化为
  `{ isError: true, content: [{ text: JSON of { errorCode, ... } }] }`，
  AI orchestrator 可以根据 `errorCode` 分支。
- `assertApiKey()` 守卫 —— tailor 在调 Claude API 前调用，
  在让 SDK 抛 401 之前先暴露 missing-key 错误。
- Chromium 自动安装 —— render service 在首次 launch 时检测 Playwright
  Chromium 缺失，自动跑 `npx playwright install chromium`（进度流到用户
  terminal）。无询问，无 postinstall hook。
- `wolf doctor` 在原有 profile 检查之外报告 `WOLF_ANTHROPIC_API_KEY` 和
  Playwright Chromium 状态。
- `wolf --help` 中 `hunt` / `score` / `fill` / `reach` 标注
  `[NOT YET IMPLEMENTED — Mn]`，让用户看到路线图而不会意外。
- 根 `CLAUDE.md` 和 `AGENTS.md` 新增 `## Workspace migrations` 和
  `## Releasing (stable npm)` 两段。

### 变更
- `better-sqlite3`：`^11.9.1` → `^12.9.0`（覆盖更新的 Node 20–25 prebuild）。
- `playwright`：`devDependencies` → `dependencies`（render service 运行时
  导入 `chromium`）。
- README 重写：7 步「5 分钟」快速上手，明确包含填 profile 步骤；dev build
  说明改为新的 `wolf-dev` 二进制。

### Engines
- Node `>=20.0.0`（移除 Node 18 EOL 支持）。
