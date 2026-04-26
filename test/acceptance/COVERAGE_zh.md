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

### Tailor (`wolf tailor`)

| Requirement | 行为 | Acceptance 覆盖 |
|---|---|---|
| `UC-06.1.1` | Tailor Resume（CLI） | `tailor/TAILOR-01`, `tailor/TAILOR-02`, `tailor/TAILOR-03` |
| `UC-07.1.1` | Generate Cover Letter（CLI） | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-04-1` | 写出 tailored `.tex` 和编译后的 PDF | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-04-2` | 保留事实准确性 — 不引入新的公司、日期、指标或技术声称 | `tailor/TAILOR-01` |
| `AC-05-1` | 在 tailored resume 旁边写出 `.md` 和 PDF cover letter | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-05-2` | Cover letter 含正确的 role title 和 company name | `tailor/TAILOR-01` |
| Analyst hint 流程（`--hint` 写 `src/hint.md`，引导 analyst brief） | `UC-06.1.1` 的子能力；没有专属 AC id | `tailor/TAILOR-03` |

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
| `AC-04-4` | Tailored resume page-count guard：超页时反复 reprompt Claude | refinement loop 断言缺失 | 新增 `tailor/TAILOR-04-page-count-guard`（需要长 resume fixture） |
| `AC-05-3` | Cover letter 缺 `md-to-pdf` 时非阻塞 | 需要无 `md-to-pdf` 的环境 | 新增 `tailor/TAILOR-05-cover-letter-degraded`（环境受控） |
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
