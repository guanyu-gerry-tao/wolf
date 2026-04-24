# Wolf 验收测试

这份文档是 wolf 的可执行验收测试套件。人可以直接读，AI 编排器也可以执行。当前不新增自定义 runner：把下面的编排器提示词复制给 agent runner，让它按 group 派发测试 agent。

## 安全规则

自动化验收测试 agent 只能在 `/tmp/wolf-at-*` 下创建测试 workspace。每一次 wolf 调用都必须显式传入 `WOLF_DEV_HOME=/tmp/wolf-at-<ID>`。

自动化 agent 绝不能创建、修改或删除：

- `~/wolf/`
- `~/wolf-dev/`
- repo 内的 `data/`
- shell RC 文件，例如 `~/.zshrc`
- `/tmp/wolf-at-*` 之外的任何非测试路径

验收运行期间，唯一允许的 repo 内变更是 `npm run build:dev` 在 `dist/` 下产生的正常构建输出。

标准调用形态：

```bash
cd /Users/guanyutao/developers/personal-projects/wolf
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-at-T02 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-at-T02 npm run wolf -- status
rm -rf /tmp/wolf-at-T02
```

## 如何运行

把这段提示词复制给 Claude Code 或其他 agent runner：

```text
You are the Wolf Acceptance Test Orchestrator.

1. Read docs/dev/ACCEPTANCE_TESTS.md.
2. Identify all groups except GROUP-H. Skip tests with Cost: high unless the
   user explicitly says --allow-costly.
3. Dispatch one sub-agent per group in parallel. Each group agent must:
   a. cd /Users/guanyutao/developers/personal-projects/wolf
   b. run npm run build:dev once for the group
   c. run the group's tests in order
   d. use WOLF_DEV_HOME=/tmp/wolf-at-<ID> for every wolf invocation
   e. create and clean up only its own /tmp/wolf-at-* workspace
   f. record pass/fail/skipped with captured stdout, stderr, and exit code
4. Never touch ~/wolf, ~/wolf-dev, repo data/, or shell RC files.
5. After all groups finish, print per-group and overall pass/fail/skipped
   counts. Include failure evidence inline.
```

## 分组

| Group | Tests | Kind | 默认模型 | 说明 |
|---|---|---|---|---|
| GROUP-A init | T-01 | reset | haiku | 可脚本化 init 和 dev 标记 |
| GROUP-B read commands | T-02, T-03 | reset | haiku | 空 workspace 的 status 和 job list |
| GROUP-C config | T-04, T-05 | reset | haiku | config get/set 往返 |
| GROUP-D profile | T-06 | reset | haiku | profile list 默认状态 |
| GROUP-E env | T-07 | reset | haiku | 只测 env show |
| GROUP-F workflows | W-A, W-B | chain | sonnet | add/status/list 流程 |
| GROUP-H human-only | H-01, H-02, H-03, H-04 | human | - | 编排器默认跳过 |

## 独立测试

### T-01 - `wolf init --dev --empty` 创建有效 dev workspace

**Group:** GROUP-A init  
**Kind:** reset  
**Cost:** free  
**Requires:** nothing

**给 group agent 的提示：**

创建 `/tmp/wolf-at-T01`，运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T01 npm run wolf -- init --dev --empty
```

确认 `wolf.toml`、`profiles/default/profile.toml`、`profiles/default/resume_pool.md` 和 `data/` 都只出现在 `/tmp/wolf-at-T01` 下。确认 `wolf.toml` 包含 `[instance] mode = "dev"`。确认没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo `data/`。只清理 `/tmp/wolf-at-T01`。

**通过标准：**

- 退出码为 0。
- stderr 出现 dev banner。
- 所有 workspace 文件都在 `/tmp/wolf-at-T01` 下。
- `wolf.toml` 有 `instance.mode = "dev"`。

### T-02 - 空 workspace 上的 `wolf status`

**Group:** GROUP-B read commands  
**Kind:** reset  
**Cost:** free  
**Requires:** T-01 pattern

初始化 `/tmp/wolf-at-T02` 后运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T02 npm run wolf -- status
```

检查命令输出时忽略 dev banner。只清理 `/tmp/wolf-at-T02`。

**通过标准：**

- 退出码为 0。
- stdout 包含 `tracked`、`tailored`、`applied`。
- 每个计数都是 `0`。
- stderr 出现 dev banner。

### T-03 - 空 workspace 上的 `wolf job list --search "%"`

初始化 `/tmp/wolf-at-T03` 后运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T03 npm run wolf -- job list --search "%"
```

**通过标准：**

- 退出码为 0。
- stdout 包含 `No jobs match.`
- stderr 出现 dev banner。

### T-04 - `wolf config get tailor.model` 返回默认值

初始化 `/tmp/wolf-at-T04` 后运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T04 npm run wolf -- config get tailor.model
```

**通过标准：**

- 退出码为 0。
- stdout 包含 `anthropic/claude-sonnet-4-6`。
- stderr 出现 dev banner。

### T-05 - `wolf config set` 写入并读回

初始化 `/tmp/wolf-at-T05` 后运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T05 npm run wolf -- config set tailor.model anthropic/claude-haiku-4-5
WOLF_DEV_HOME=/tmp/wolf-at-T05 npm run wolf -- config get tailor.model
```

**通过标准：**

- 两个命令退出码都是 0。
- 最终 stdout 包含 `anthropic/claude-haiku-4-5`。
- `/tmp/wolf-at-T05/wolf.toml.backup1` 存在。
- stderr 出现 dev banner。

### T-06 - `wolf profile list` 显示 default profile

初始化 `/tmp/wolf-at-T06` 后运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T06 npm run wolf -- profile list
```

**通过标准：**

- 退出码为 0。
- stdout 有带 `*` 的 `default` profile 行。
- stderr 出现 dev banner。

### T-07 - 没有 key 时的 `wolf env show`

只在子进程中清掉 WOLF key：

```bash
env -u WOLF_ANTHROPIC_API_KEY -u WOLF_APIFY_API_TOKEN -u WOLF_GMAIL_CLIENT_ID -u WOLF_GMAIL_CLIENT_SECRET npm run wolf -- env show
```

不要运行 `wolf env clear`。

**通过标准：**

- 退出码为 0。
- stdout 标记每个 key 为 not set。
- stdout 不包含任何 secret 值。
- stderr 出现 dev banner。

## 链式流程

### W-A - add -> status -> list happy path

使用共享 workspace `/tmp/wolf-at-WA`：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-WA npm run wolf -- add --title "Backend Engineer" --company "Acme" --jd-text "Build APIs in TypeScript."
WOLF_DEV_HOME=/tmp/wolf-at-WA npm run wolf -- status
WOLF_DEV_HOME=/tmp/wolf-at-WA npm run wolf -- job list --search Acme
```

**通过标准：**

- 所有命令退出码为 0。
- `add` 返回包含 `jobId` 的 JSON。
- `status` 显示 `tracked  1`。
- `job list` 显示 `Acme` 和 `Backend Engineer`。
- 每个命令 stderr 都出现 dev banner。

### W-B - 多 job 搜索行为

使用共享 workspace `/tmp/wolf-at-WB`：

```bash
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- add --title "Frontend Engineer" --company "Acme" --jd-text "React UI work."
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- add --title "Platform Engineer" --company "Acme" --jd-text "Internal platform work."
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- job list --search Acme
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- job list --search Other
```

**通过标准：**

- 所有命令退出码为 0。
- `Acme` 搜索显示两个 job。
- `Other` 搜索输出 `No jobs match.`
- 每个命令 stderr 都出现 dev banner。

## 人工测试

### H-01 - `wolf init` 交互 UX

**Kind:** human  
**Cost:** free  
**跳过原因:** 需要人工判断提示文案和交互体验。

### H-02 - 真实 JD 上的 `wolf tailor` 质量

**Kind:** human  
**Cost:** high  
**跳过原因:** 会调用 Anthropic，且需要人工质量评审。

### H-03 - 真实申请表上的 `wolf fill`

**Kind:** human  
**Cost:** medium  
**跳过原因:** 使用浏览器自动化，可能接触真实网站。

### H-04 - `wolf env clear`

**Kind:** human  
**Cost:** free  
**跳过原因:** 会修改 `~/.zshrc` 等 shell RC 文件。

## 执行规则

任何新增或改变 CLI 行为的 PR，都必须在同一个 PR 更新本文档。确定性且免费的行为用 `kind: reset`，多步骤流程用 `kind: chain`，交互式、高成本、浏览器、邮件或全局 shell 状态相关行为用 `kind: human`。
