# Acceptance 覆盖矩阵

这个矩阵把已实现或计划中的用户行为映射到 acceptance test group 和 case。想知道
"这个 use case 有没有被测到" 时，先看这里。

下面 AC 描述以
[`docs/requirements/ACCEPTANCE_CRITERIA.md`](../../docs/requirements/ACCEPTANCE_CRITERIA.md)
为准；UC id 来自
[`docs/requirements/USE_CASES.md`](../../docs/requirements/USE_CASES.md)。

## 已实现覆盖

### Add (`wolf add`)

| Requirement | 行为 | Acceptance 覆盖 |
|---|---|---|
| `UC-02.2.1` | 从粘贴的 JD 数据添加结构化 job（CLI） | `add/ADD-01`, `add/ADD-02` |
| `AC-10-1` | `wolf_add` 返回 `jobId`（只覆盖 CLI 等价形态；MCP 变体 `UC-02.2.2` 未测） | `add/ADD-01` |

### Profile 数据治理（`wolf profile`）

| Requirement | 行为 | Acceptance 覆盖 |
|---|---|---|
| `AC-11-1` | `wolf profile fields` 暴露 `PROFILE_FIELDS` schema 参考，包括 required/json/single-path 模式 | `profile/PROFILE-01` |
| `AC-11-2` | `wolf profile show` 打印 raw `profile.toml`；`wolf profile get <path>` 打印单个字段值 | `profile/PROFILE-01` |
| `AC-11-3` | `wolf profile set <path> <value>` 精确更新标量字段 | `profile/PROFILE-02` |
| `AC-11-4` | `wolf profile set <path> --from-file <file>` 更新多行内容，且不加入虚假尾随换行 | `profile/PROFILE-02` |
| `AC-11-5` | `wolf profile add/remove experience|project|education` 管理 resume-source array entries | `profile/PROFILE-03` |
| `AC-11-6` | `wolf profile add question --prompt --answer` 创建自定义 question；自定义 question 可删除 | `profile/PROFILE-04` |
| `AC-11-7` | Wolf-builtin question 的 prompt/required/remove 操作被拒绝，但 answer 仍可编辑 | `profile/PROFILE-05` |
| `AC-11-8` | 无效 profile path、type、缺失 value 和不安全写入失败，且不破坏 `profile.toml` | `profile/PROFILE-06` |

### Tailor (`wolf tailor`)

| Requirement | 行为 | Acceptance 覆盖 |
|---|---|---|
| `UC-06.1.1` | Tailor Resume（CLI） | `tailor/TAILOR-01`, `tailor/TAILOR-02`, `tailor/TAILOR-03`, `tailor/TAILOR-04` |
| `UC-07.1.1` | Generate Cover Letter（CLI） | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-04-1` | 写出 tailoring brief、`resume.html`、`resume.pdf`，并把 resume PDF 路径写回 Job 行 | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-04-2` | 保留事实准确性 — 不引入新公司/日期/指标/声称、不杜撰整段 section、section 顺序跟随 pool | `tailor/TAILOR-01`, `tailor/TAILOR-04` |
| `AC-05-1` | 在 tailored resume 旁边写出 `cover_letter.html` 和 `cover_letter.pdf`，并把 cover letter PDF 路径写回 Job 行 | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-05-2` | Cover letter 含正确的 role title 和 company name | `tailor/TAILOR-01` |
| Analyst hint 流程（`--hint` 写 `src/hint.md`，引导 analyst brief） | `UC-06.1.1` 的子能力；没有专属 AC id | `tailor/TAILOR-03` |

### Job 数据治理（`wolf job show|get|set|fields`）

| Requirement | 行为 | Acceptance 覆盖 |
|---|---|---|
| `AC-12-1` | `wolf job fields` 暴露 `JOB_FIELDS` schema 参考，包括 required/json/single-field 模式 | `job/JOB-GOV-01` |
| `AC-12-2` | `wolf job show` 和 `wolf job get` 读取 flat job columns 和 `description_md` | `job/JOB-GOV-01` |
| `AC-12-3` | `wolf job set` 对可编辑字段做类型转换并持久化，包括 `description_md --from-file` | `job/JOB-GOV-02` |
| `AC-12-4` | Salary 约定接受 `salaryLow=0` 加正数 `salaryHigh`，blank/null 仍表示 unknown | `job/JOB-GOV-03` |
| `AC-12-5` | 无效 job 写入被拒绝，且保留旧值 | `job/JOB-GOV-04` |
| `AC-12-6` | System-managed 字段可读，但会被 `wolf job set` 拒绝写入 | `job/JOB-GOV-05` |

### Job tracking (`wolf status` + `wolf job list`)

| Requirement | 行为 | Acceptance 覆盖 |
|---|---|---|
| `AC-08-1` | `wolf status` 每个注册模块输出一行 count | `job-tracking`（group 级） |
| `AC-08-2` | `wolf status` 单 counter 失败时其他仍打印；失败 counter 显示 `0 [error: ...]` | `job-tracking`（group 级） |
| `AC-08-3` | `wolf job list` 默认表格输出（id / company / title / status / score；limit 20） | `job-tracking/JOB-01` |
| `AC-08-4` | 多个结构化 filter 用 AND 语义组合 | `job-tracking/JOB-01` |
| `AC-08-5` | `--search` 匹配 title / company / location（不区分大小写子串） | `job-tracking/JOB-01` |
| `AC-08-6` | 多个 `--search` 之间是 OR | `job-tracking/JOB-01` |
| `AC-08-6b` | search 与结构化 filter 在顶层用 AND 组合 | `job-tracking/JOB-01` |
| `AC-08-6c` | search term 接受 SQL `LIKE` 通配符 `%` / `_` | `job-tracking`（仅 group 级，无专属 case） |
| `AC-08-7` | `--start` / `--end` 时间范围；非法日期报清晰错误 | `job-tracking/JOB-03` |
| `AC-08-8` | 超过 limit 时显示溢出 footer | `job-tracking/JOB-02` |
| `AC-08-9` | 无匹配时打印 `No jobs match.` | `job-tracking/JOB-01` |
| `AC-08-10` | `--json` 输出 pretty-printed JSON | `job-tracking/JOB-02` |
| `AC-08-11` | 无效输入抛清晰错误（不静默返回空） | `job-tracking/JOB-03` |
| `AC-08-12` | 没有 `--all` flag；JD 内容不能在 CLI 中搜 | `job-tracking/JOB-03` |

## 已知 Acceptance 覆盖缺口

下面这些行为已经实现（或在 ACCEPTANCE_CRITERIA.md 有定义），但当前没有 acceptance
case 覆盖。这是下一批要补的 case，按优先级排序。

| Requirement | 行为 | 为什么还没覆盖 | 建议 case |
|---|---|---|---|
| `AC-04-3` | `wolf tailor full <jobId> --diff` 打印每个改动 bullet 的前后对比 | `--diff` 输出从未被断言 | 扩展 `tailor/TAILOR-02` 或新增 `TAILOR-04-diff` |
| `AC-04-4` | Tailored resume 单页 fit-loop 二分搜索；floor 仍溢出时抛 `CannotFitError` | fit-loop 在长 resume fixture 上的断言缺失 | 新增 `tailor/TAILOR-04-fit-loop-overflow`（需要超长 resume fixture） |
| `AC-05-3` | HTML+Playwright 流水线无系统级依赖 | 干净机器 smoke 隐式覆盖，但没有专属 case | 可选：新增 `tailor/TAILOR-05-no-system-deps`（CI-only：无 xelatex / md-to-pdf 环境） |
| `AC-01-*` | `wolf init` 流程相关 AC | 当前由 smoke `bootstrap` 覆盖，不在 acceptance | 决定是否把 smoke `bootstrap` 提升为 acceptance `init` group |
| `AC-09-*` | `wolf env show` mask；`wolf env clear` 移除 RC lines | 没有 acceptance group；`wolf env clear` 会修改用户 shell RC，自动化测试禁止 | 新增 `env` group：`clear` 走 `human-guided`，`show` 走 automated |
| `UC-02.2.2` / `UC-06.1.2` / `UC-07.1.2` | add / tailor / cover-letter 的 MCP 变体 | 整个 `mcp-contract` group 是 `planned` | 在 `mcp-contract` planned group 下追踪 |

## 计划中覆盖

| 产品领域 | Group | 状态 |
|---|---|---|
| Job discovery providers 和 dedupe | `hunt` | planned |
| Job scoring 和 hard filters | `score` | planned |
| Application form analysis 和 fill dry-run | `fill` | planned |
| Outreach draft 和 send boundaries | `reach` | planned |
| MCP tool schema 和 response contracts | `mcp-contract` | planned |

当某个功能从 planned 变成 implemented 时，必须在同一个 change 里更新这个矩阵和
acceptance case。在 `docs/requirements/ACCEPTANCE_CRITERIA.md` 加新 AC 时，同 PR 里
也要在这个矩阵加一行 —— 即使是直接放进 "已知缺口" 表里。
