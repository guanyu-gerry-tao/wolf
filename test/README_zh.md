# Wolf 测试套件

wolf 的测试分两层：

- `smoke/` 是快速门禁。它证明 dev build、workspace 隔离和核心 CLI 路径还没坏。smoke 通过不代表功能覆盖完整。
- `acceptance/` 是覆盖门禁。它把已实现行为映射回 `docs/requirements/USE_CASES.md` 和 `docs/requirements/ACCEPTANCE_CRITERIA.md`。

## 目录结构

```text
test/
├── README.md
├── README_zh.md
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

## 安全规则

自动化测试把运行 workspace 写到 `/tmp/wolf-test/`，把持久报告写到 repo 本地的 `test/runs/`。

每次 wolf 调用都必须显式传入：

```text
WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>
```

自动化 agent 绝不能创建、修改或删除：

- `~/wolf/`
- `~/wolf-dev/`
- repo 内的 `data/`
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

每个 group 都必须写持久化报告：

```text
test/runs/<suite>-<timestamp>/reports/<group-id>/report.md
```

编排器还必须写：

```text
test/runs/<suite>-<timestamp>/report.md
test/runs/LATEST.md
```

`report.md` 是 suite 总结。`LATEST.md` 指向最近一次运行和关键失败报告，方便 coding agent 直接读取。

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
