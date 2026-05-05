# Wolf 测试套件

wolf 的测试分两层：

- `smoke/` 是快速门禁。它证明 dev build、workspace 隔离和核心 CLI 路径还没坏。smoke 通过不代表功能覆盖完整。
- `acceptance/` 是覆盖门禁。它把已实现行为映射回 `docs/requirements/USE_CASES.md` 和 `docs/requirements/ACCEPTANCE_CRITERIA.md`。

## 目录结构

```text
test/
├── README.md
├── README_zh.md
├── fixtures/
│   ├── jd/
│   │   ├── README.md
│   │   ├── README_zh.md
│   │   ├── raw/
│   │   └── scripts/
│   └── resume/
│       ├── README.md
│       ├── README_zh.md
│       ├── raw/
│       └── scripts/
├── smoke/
│   ├── README.md
│   ├── README_zh.md
│   └── groups/
│       └── <group-id>/
│           ├── README.md
│           └── README_zh.md
└── acceptance/
    ├── README.md
    ├── README_zh.md
    └── groups/
        └── <group-id>/
            ├── README.md
            └── README_zh.md
```

每个 group 只测试一个产品方面。不要把无关领域混在一个 group 里：`hunt` 测试不和 `fill` 混放，`tailor` 不和 `reach` 混放，MCP contract 测试也不要和 CLI 工作流测试混放，除非该 group 明确就是端到端 workflow group。

## Fixtures

共享的离线测试输入放在 `test/fixtures/`。

- `test/fixtures/jd/` 包含一个小型 CC0 计算机相关 job-posting CSV，以及
  `scripts/sample_raw_jd.py`，用于输出一段接近用户复制粘贴的真实 JD。
- `test/fixtures/resume/` 包含一个小型计算机相关 resume CSV，以及
  `scripts/sample_raw_resume.py`，用于输出一份接近用户复制粘贴的真实 resume。

Acceptance case 应该调用 fixture 脚本，而不是在测试文档里嵌入很长的 resume 或
JD 文本。脚本把测试输入输出到 stdout，把可选 source metadata 输出到 stderr，
这样报告可以记录来源，又不会污染 `jdText` 或 resume input。

## 安全规则

自动化测试把运行 workspace 写到 `/tmp/wolf-test/`，把持久报告写到 repo 本地的 `test/runs/`。

每次 wolf 调用都必须显式传入：

```text
WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>
```

自动化 agent 绝不能创建、修改或删除：

- `~/wolf/`
- `~/wolf-dev/`
- repo 内 `data/` 下的运行时文件（`data/.gitkeep` 是被 git 跟踪的占位文件，不算测试写入）
- shell RC 文件，例如 `~/.zshrc`
- `/tmp/wolf-test/` 之外的任何路径

报告、日志和轻量 artifact 索引可以写到 `test/runs/<run-id>/`。`test/runs/` 目录通过 `.gitkeep` 保留在 git 里，但其中每次运行产生的结果都被 gitignore，因为报告是本地运行输出，不是共享测试定义。

自动化运行期间，唯一允许的 repo 内变更是 `npm run build:dev` 在 `dist/` 下产生的正常构建输出。

## 执行模式

- `automated`：agent 可以直接运行命令并判断结果。
- `ai-reviewed`：agent 运行命令，然后由 AI reviewer 按 rubric 检查产物。
- `human-guided`：人类测试员按照明确指令执行受限步骤。
- `human-approval`：自动化在外部副作用前停止，等待人类批准。
- `skipped-by-default`：高成本、高风险或依赖账号的测试默认跳过，除非用户明确允许。

优先使用确定性断言，其次使用 AI 产物评审；只有涉及外部副作用或最终主观判断时，才引入人类。

## Runner 交互规则

按 agent runner 的正常执行模式运行测试套件。尽量走最低交互路径：

- 不要每条命令都要求人类批准。
- runner 允许时，把相关安全命令批量执行。
- 只有在 runner 权限边界要求时，或即将产生外部副作用前，才请求人类批准。
- 如果 runner 需要先给一个短计划或 checklist，这是允许的，但同一个任务里必须继续执行。
- 不要只返回 plan 就停止。一次测试运行必须以报告结束。
- 如果 approval 被拒绝或不可用，写 `BLOCKED` 报告，说明哪条 command 需要 approval、为什么需要、哪些内容没有运行。

## 必须写报告

每个 group agent 应该先把原始报告和命令日志写到 runtime tree：

```text
/tmp/wolf-test/<suite>/<run-id>/reports/<group-id>/report.md
/tmp/wolf-test/<suite>/<run-id>/reports/<group-id>/logs/
```

group agent 的最终回复必须返回原始 report path，方便 orchestrator 直接读取。

orchestrator 负责把每个原始 group report 复制到 repo 本地运行记录：

```text
test/runs/<suite>-<timestamp>/reports/<group-id>/report.md
```

编排器还必须写：

```text
test/runs/<suite>-<timestamp>/report.md
test/runs/LATEST.md
```

`report.md` 是 suite 总结。`LATEST.md` 指向最近一次运行和关键失败报告，方便 coding agent 直接读取。repo 本地的 `test/runs/` 副本是后续 coding agent 的持久交接物；`/tmp/wolf-test/` 保留为 runtime evidence 区域。

group 报告必须包含：

- 测试标题
- 测试目的
- 环境：cwd、commit、suite、group、run id、时间戳、build 命令
- 命令过程：command、cwd、重要 env、exit code
- stdout 和 stderr 记录；短输出可以内联，长输出保存在 group 报告目录下
- 每个 case 的结果：`PASS`、`FAIL`、`SKIPPED` 或 `BLOCKED`
- 每条通过标准对应的证据
- bug：复现步骤、预期行为、实际行为、严重程度、相关 workspace 路径
- 改进建议：为什么重要、建议怎么改

agent 对话不是事实来源。即使 agent 关闭，报告文件也必须能说明发生了什么。

## 结果标签

- `PASS`：每条通过标准都有具体证据。
- `FAIL`：命令失败、输出不符合预期、产物评审失败，或违反安全规则。
- `SKIPPED`：因为成本、风险、缺少凭证或需要人工而有意不运行。
- `BLOCKED`：前置条件失败，所以无法判断该 case。

## 人工指导

human-guided 测试必须包含：

- 为什么需要人类
- 测试员准备
- 精确步骤
- 预期结果
- 边界情况
- 通过/失败 rubric
- 需要捕获的证据
- 停止条件
- 清理步骤

人工测试应该很少。对于简历、cover letter 等质量检查，优先使用 `ai-reviewed`：先生成产物，让 AI reviewer 按 rubric 检查，把评审写入 `report.md`，人类复核只作为可选后续。

## Companion 视觉审查

Chrome extension 有自己一套 Playwright 驱动的 harness，放在
`extension/test/visual/`。它跟上面的 smoke / acceptance 套件**互相独立**：
不跑 `wolf` 命令、不动 workspace、也不需要 `wolf serve` 起来。它会启一个
极小的 mock daemon，静态 serve `extension/dist/` 构建产物，然后跨三档
side panel 宽度渲染所有命名场景。

从仓库根目录运行：

```bash
cd extension
npm install      # 只装一次
npm run build    # 出 dist/
npm run review   # 抓状态矩阵
```

输出：

- `extension/test/visual/snapshots/current/<state>--<viewport>.png` —
  每个场景 × viewport 一张 PNG，目前共 24 张。
- `extension/test/visual/report.md` — markdown 表格列出所有截图，
  每次跑都重新生成。
- `extension/test/visual/snapshots/baseline/` — 应该 commit 进 git 的
  基线 PNG，将来 diff 用。还没填，等某次渲染通过审核后把 `current/`
  提升成 `baseline/`。

场景定义在 `extension/test/visual/states.ts`（`first-run`、
`disconnected`、`connected-empty`、`has-imports`、`has-processed`、
`has-tailored`、`runtime-not-ready`、`config-open`）。新增场景就在那里
加一条，附 mock 预设和可选页面 setup 脚本。viewports 在
`extension/test/visual/viewports.ts`（320 / 400 / 560）。

harness 只需要 Node 22+（用 `--experimental-strip-types` 直接跑 TS，
没有额外编译步骤），以及全仓已经装好的 Playwright Chromium。零新依赖。

如果是 companion 重设计 PR 的**一次性人工验收**——load unpacked 进真
Chrome，走 onboarding、import → process → tailor、resize side panel 等
端到端流程——见 [`companion-redesign-manual_zh.md`](companion-redesign-manual_zh.md)。
这份在合并 redesign 分支之前跑一遍即可；之后的回归交给视觉 harness。
