# 用例 — wolf

Actor 为"User"（通过 CLI 操作的人类用户）或"Agent"（通过 MCP 操作的 AI 编排器），除非特别说明。

## UC-00 · 安装前准备

**Actor：** User
**前置条件：** 无

- 1 - 用户将 GitHub 链接粘贴给 AI，询问如何使用本项目。
- 2 - AI 读取 README，告知用户 wolf 可通过 `CLI` 或 `MCP` 运行。AI 建议用户优先通过 MCP 初始化，并引导用户完成以下步骤：
   - a - 创建一个专用文件夹作为 wolf 工作区（例如 `~/wolf-workspace`）。
   - b - 通过 `npm` 安装 wolf。
   - c - 使用 README 中提供的可复制配置块配置 MCP 插件，其中 `cwd` 设置为步骤 a 中创建的工作区文件夹。
- 3 - 用户完成上述步骤；MCP 服务器现已配置为以正确的工作目录启动。

下一步：AI 建议用户优先通过 MCP 初始化。继续至 UC-01.1.2。

## UC-01.1.1 · 运行初始化（`wolf init` — CLI）

**Actor：** User
**前置条件：** wolf 已安装；工作区中不存在 `wolf.toml`。

- 1 - 用户运行 `wolf init`。
- 2 - wolf 显示当前目录（`pwd`），告知用户该目录将作为 wolf 工作区，建议在熟悉且易于管理的位置运行此命令，并请求确认。
   - 2.1 - 若当前目录已有文件 → wolf 发出额外警告并再次请求确认。
     - 2.1.1 - 若用户拒绝 → 退出；提示用户 `cd` 至目标目录后重新运行。
- 3 - wolf 依次提示输入 profile 字段：姓名、邮箱、电话、LinkedIn URL、目标职位、目标地点、工作授权状态、是否愿意搬迁。
   - 3.1 - 若用户对可选字段按回车 → 跳过；继续至下一字段。
- 4 - wolf 在默认编辑器中打开 `resume_pool.md`。
   - 4.1 - 若用户未保存直接关闭编辑器 → wolf 警告 resume_pool.md 为空；继续。
- 5 - wolf 将 `wolf.toml` 写入工作区根目录。
- 6 - wolf 检查环境变量中是否存在 `WOLF_ANTHROPIC_API_KEY`。
   - 6.1 - 若已设置 → 显示掩码预览（前 4 位 + 后 4 位）；标记为已配置。
   - 6.2 - 若未设置 → 打印设置说明；继续（初始化完成不要求该 key）。
- 7 - wolf 打印所有 `WOLF_*` key 的汇总（已设置 / 未设置），列出可用 CLI 命令，建议运行 `--help` 查看详情，然后退出。

## UC-01.1.2 · 运行初始化（MCP）

**Actor：** AI Agent（如 OpenClaw、Claude Code 或 Claude Chat）
**前置条件：** wolf 已安装；工作区中不存在 `wolf.toml`；AI 已安装 wolf MCP 插件。

- 1 - 用户询问 AI："我刚装好 wolf，接下来要怎么做？"
- 2 - AI 读取 `wolf_setup` MCP tool 描述，了解 profile 信息和 resume pool 内容所需的字段（字段 TBD，由 tool 描述定义）。
- 3 - AI 向用户提问以收集所有必要的 profile 和简历字段，并记录回答。
- 4 - AI 携带收集到的 profile 和简历数据调用 `wolf_setup`；wolf 生成工作区文件结构、写入 `wolf.toml` 并生成 `resume_pool.md`。`wolf_setup` 返回生成的 `resume_pool.md` 内容、`wolf.toml` 内容，以及 API key 是否已配置。
- 5 - AI 向用户展示生成的 `resume_pool.md` 内容并请求确认。AI 还应以自然语言描述 `wolf.toml` 内容并请求确认。
   - 5.1 - 若用户请求修改 → AI 更新相关字段并以修正后的数据再次调用 `wolf_setup`；从步骤 5 重复。
- 6 - AI 确认设置完成。
   - 6.1 - 若 API key 未配置 → AI 告知用户需要设置 API key，说明如何注册和获取，并提供可复制的代码块（例如 `export WOLF_ANTHROPIC_API_KEY=your_key_here`），指导用户将其添加到 `~/.zshrc` 后运行 `source ~/.zshrc` 或重启终端。

## UC-02.1.1 · 搜索职位（`wolf hunt`）

**Actor：** User 或 Agent
**前置条件：** `wolf.toml` 存在；至少配置了一个数据源。

- 1 - 用户运行 `wolf hunt`。
- 2 - wolf 从 `wolf.toml` 读取数据源列表。
   - 2.1 - 若未配置任何数据源 → 打印设置提示并退出。（提示内容 TBD）
- 3 - 对每个数据源，wolf 通过 `JobProvider` 接口获取职位列表。
   - 3.1 - 若某数据源返回错误 → 记录错误，跳过该数据源，继续处理其他数据源。
- 4 - wolf 按 URL 去重（规范化处理，去除 query 参数）。URL 已存在于 DB 的职位直接跳过——多来源重复（同一职位同时挂在 LinkedIn 和 Handshake）保留为独立记录，在 fill 阶段兜底处理。
- 5 - wolf 将新职位以 `status: new`、`score: null` 保存至 SQLite。
- 6 - wolf 打印汇总：获取 N 条，跳过 M 条重复，保存 K 条新职位。
- 7 - `CLI` 提示下一步操作（例如"运行 `wolf score` 对照你的 profile 评估这些职位"）。

## UC-02.1.2 · 搜索职位（MCP）

**Actor：** AI Agent（如 OpenClaw）
**前置条件：** wolf 已安装；`wolf.toml` 存在且至少配置了一个数据源。

- 1 - 用户询问 AI："你能帮我找些职位吗？"或"我们去找工作！"或"用 wolf 帮我找职位！"
- 2 - AI 调用 `wolf_hunt` MCP tool，无需参数。
- 3 - wolf 按 UC-02.1.1 步骤 2–5 执行搜索，并将结果汇总（获取 N 条、跳过 M 条重复、保存 K 条新职位）返回给 AI。AI 以自然语言向用户转述。
- 4 - AI 可建议下一步（例如"我为你找到了 K 个新职位，需要我对照你的 profile 为它们评分吗？"）并引导用户继续工作流。

## UC-02.2.1 · 手动添加职位（`wolf add` — CLI）

**Actor：** User
**前置条件：** `wolf.toml` 存在；用户有一个想跟踪的目标职位。

- 1 - 用户运行 `wolf add` 并提供必要参数：
   - `--title <title>` — 职位名称
   - `--company <company>` — 公司名称
   - 以下之一：
     - `--jd <text>` — 内联职位描述文本
     - `--file <path>` — 包含 JD 内容的纯文本文件路径
   - 可选：`--url <url>` — 原始招聘帖子链接
- 2 - wolf 检查 DB 中是否已有相同 URL 的职位（URL 规范化，去除 query 参数）。
   - 2.1 - URL 未找到 → 继续步骤 3。
   - 2.2 - URL 已存在，现有状态为 `new` / `reviewed` / `filtered` / `ignored` / `rejected` / `closed` → 覆盖已有记录并警告："职位已存在（jobId: xxx）；记录已更新。"
   - 2.3 - URL 已存在，现有状态为 `applied` / `applied_previously` / `interview` / `offer` → 不存入新记录；返回已有 `jobId` 并警告："你已申请过此职位。"
- 3 - wolf 按公司名查询数据库。
   - 3.1 - 若公司不存在 → wolf 创建新公司记录。
   - 3.2 - 若公司已存在 → wolf 复用已有记录。
- 4 - wolf 以 `status: new`、`score: null` 保存职位。
- 5 - wolf 打印分配的 `jobId`，并提示下一步（如"职位已保存。运行 `wolf tailor <jobId>` 定制简历"）。

## UC-02.2.2 · 手动添加职位（MCP）

**Actor：** AI Agent（如 Claude Code、OpenClaw）
**前置条件：** `wolf.toml` 存在；用户已有一个目标职位（链接、粘贴的 JD、截图或口头描述）。
**注意：** AI 调用方负责从原始输入中提取结构化字段，wolf 只负责存储。

- 1 - 用户以任意形式向 AI 分享一个职位：URL、粘贴的职位描述、截图，或口头描述（如"Stripe 有个 PM 职位我想记录下来"）。
- 2 - AI 读取内容（如需则抓取 URL、对截图进行 OCR 或解析文本），提取：`title`、`company`、`jdText`，以及可选的 `url`。
- 3 - AI 携带提取的字段调用 `wolf_add`。
- 4 - wolf 执行与 UC-02.2.1 步骤 2.1–2.3 相同的 URL 去重逻辑。
   - 4.1 - 无 URL 碰撞 → wolf 查询公司、创建或复用记录、保存职位，返回 `{ jobId, created: true }`。
   - 4.2 - URL 碰撞，尚未申请 → wolf 覆盖已有记录，返回 `{ jobId, created: false, warning: "existing record updated" }`。
   - 4.3 - URL 碰撞，已申请 → wolf 不存新记录，返回 `{ jobId, created: false, warning: "already applied" }`。
- 5 - AI 向用户转述结果。
   - 5.1 - 已创建 → "已保存。要我现在评分，还是为它定制简历？"
   - 5.2 - 已申请 → "你已申请过此职位（jobId: xxx），未创建新记录。"

后续：成功时，AI 可立即链式调用 `wolf_score`（传入 `{ jobId, single: true }` 同步评分）或 `wolf_tailor`（传入 `{ jobId }` 生成定制简历）。

## UC-03.1.1 · 评分（`wolf score`）

**Actor：** User
**前置条件：** DB 中至少存在一条 `score: null` 的职位。

- 1 - 用户运行 `wolf score`，可选参数：
   - `--profile <profileId>` → 指定评分用的 profile。（TBD：多 profile 支持——当前为占位参数；默认使用 `wolf.toml` 中的 `default_profile`。）
   - `--jobid <jobId>` → 仅对指定职位同步评分，跳过 Batch API。
- 2 - wolf 从 SQLite 读取所有 `score: null` 或 `status: score_error` 的职位（若设置了 `--jobid` 则仅读取指定职位）。
- 3 - wolf 将职位批量提交至 Claude Batch API。每个请求包含完整 JD 文本和用户 profile（简历、偏好）。CLI 在轮询批次结果时提供进度更新。Claude 对每个职位返回结构化响应，包含：
   - 结构化 JD 字段（技术栈、是否需要 sponsorship、是否远程、薪资范围）
   - 过滤决定：`filtered` 或 `pass`，附带原因（例如"需要签证 sponsorship"）
   - 匹配分数（0.0–1.0）
   - 评分说明（例如"TypeScript 匹配度强；缺乏所需的金融科技领域经验"）
   - 3.1 - 若设置了 `--jobid` → 跳过批次，改为单次同步调用。
   - 3.2 - 若响应格式错误或缺少必要字段 → 记录"正在重试职位 N/M..."，使用更严格的 prompt 重试一次。若重试仍失败 → 将该职位标记为 `status: score_error` 并附上原因，继续处理下一条。
- 4 - wolf 将所有结果写入 SQLite：结构化字段、过滤状态、分数和说明。
- 5 - wolf 打印汇总（例如"已评分 N 条职位：X 条高匹配（≥0.7），Y 条中等匹配（0.4–0.7），Z 条已过滤，W 条错误"），并提示下一步（例如"运行 `wolf list --jobs` 查看评分结果"）。

## UC-03.1.2 · 评分（MCP）

**Actor：** AI Agent
**前置条件：** `wolf.toml` 存在；DB 中至少存在一条 `score: null` 的职位。

- 1 - 用户要求 AI 对职位评分（例如"给你找到的职位评个分"或"哪些职位最适合我？"）。
- 2 - AI 无参数调用 `wolf_score` 对所有待评分职位评分。
   - 2.1 - 若只对单个职位评分 → AI 携带 `{ jobId }` 调用 `wolf_score`。
   - 2.2 - `profileId` 参数为未来多 profile 支持的占位参数（TBD）；目前省略。
- 3 - wolf 按 UC-03.1.1 步骤 2–5 执行评分，并返回每条职位的结果，包括分数、过滤状态、说明和错误信息。
- 4 - AI 以自然语言摘要向用户展示结果，突出显示高匹配职位。

## UC-04.1.1 · 列表（`wolf list`）

**Actor：** User
**前置条件：** 本地 DB 中至少存在一条记录。

`wolf list` 必须指定 `--jobs` 或 `--companies` 中的一个。

**变体 — `wolf list --jobs`：**

- 1 - 用户运行 `wolf list --jobs`，可选过滤参数：
   - `--profile <profileId>` → 使用指定 profile 的 evaluations。（TBD：多 profile 支持——当前为占位参数；默认使用 `wolf.toml` 中的 `default_profile`。）
   - `--score <n>` → 仅显示分数 ≥ n 的职位。
   - `--selected` → 仅显示已选中的职位。
   - `--status <value>` → 按 status 字段过滤。
   - `--date <days>` → 仅显示最近 N 天内添加的职位（例如 `7`）。
   - `--fromcompany <companyId>` → 仅显示指定公司的职位（使用 `wolf list --companies` 查找公司 ID）。
- 2 - wolf 使用给定过滤条件查询 SQLite，结果按分数降序排列。
- 3 - wolf 打印表格：公司、职位名、分数、过滤状态、选中状态、JD 链接。
   - 3.1 - 若无匹配职位 → 打印友好提示。

**变体 — `wolf list --companies`：**

- 1 - 用户运行 `wolf list --companies`。
- 2 - wolf 返回 DB 中所有不重复的公司及其 ID。
- 3 - wolf 打印表格：companyId、公司名称。

## UC-04.1.2 · 列表（MCP）

**Actor：** AI Agent
**前置条件：** 本地 DB 中至少存在一条记录。

**变体 — 职位：**

- 1 - 用户要求 AI 展示职位（例如"给我看看你找到的职位"或"哪些职位分数超过 0.7？"或"给我看 Stripe 的职位"）。
- 2 - AI 从用户请求中推导过滤参数，调用 `wolf_list`，参数如 `{ mode: "jobs", minScore: 0.7, status: "raw", date: 7, fromCompanyId: "stripe-001" }`。多个过滤条件可组合使用。`profileId` 为未来多 profile 支持的占位参数（TBD）；目前省略。
- 3 - wolf 返回结构化列表，包含 jobId、公司、职位名、分数、过滤状态和 JD 链接。
- 4 - AI 以带编号的形式向用户展示结果（例如"1. Stripe — SWE，分数 0.85 ..."）。

**变体 — 公司：**

- 1 - 用户要求 AI 展示公司（例如"我的列表里有哪些公司？"）。
- 2 - AI 调用 `wolf_list`，参数为 `{ mode: "companies" }`。
- 3 - wolf 返回所有不重复的公司及其 ID。
- 4 - AI 向用户展示公司列表。若用户想查看某个公司的职位，AI 可跟进调用 `wolf_list`，参数为 `{ mode: "jobs", fromCompanyId: "..." }`。

## UC-05.1.1 · 选择职位（`wolf select`）

**Actor：** User
**前置条件：** DB 中的职位已完成评分。

- 1 - 用户运行 `wolf select`。
- 2 - wolf 使用与 `wolf list --jobs` 相同的查询逻辑加载已评分职位，按分数降序排列。wolf 打开交互式 TUI，显示公司、职位名、分数、状态和 JD URL（纯文本）。
- 3 - 用户浏览列表，切换想要申请的职位的选中状态。DB 中对应职位的 `selected` 字段随之更新为 `true` 或 `false`。

## UC-05.1.2 · 选择职位（MCP）

**Actor：** AI Agent
**前置条件：** DB 中的职位已完成评分。

- 1 - 用户查看 UC-04.1.2 中带编号的列表，告知 AI 要选择哪些职位（例如"我要第 1、3、5 条"）。
- 2 - AI 将用户给出的编号映射至上次 `wolf_list` 响应中的 jobId，调用 `wolf_select`，参数为 `{ jobIds: [...], action: "select" }`。
- 3 - wolf 将指定职位的 `selected` 字段更新为 `true`。
   - 3.1 - 若要取消选中 → AI 调用 `wolf_select`，参数为 `{ jobIds: [...], action: "unselect" }`。
- 4 - AI 向用户确认选中结果。

## UC-06.1.1 · 定制简历（`wolf tailor`）

**Actor：** User
**前置条件：** `profile.toml` 存在；`resume_pool.md` 存在；目标职位在 DB 中。

- 1 - 用户运行 `wolf tailor`，可选参数：
   - `--profile <profileId>` → 使用指定 profile。（TBD：多 profile 支持——当前为占位参数；默认使用 `wolf.toml` 中的 `default_profile`。）
   - `--jobid <jobId>` → 仅同步定制指定职位；否则定制所有已选职位。
   - `--diff` → 打印每个职位中每条改动前后的对比。
   - `--cover-letter` → 定制完成后，为本批次的每个职位生成求职信（逻辑同 UC-07.1.1）。
- 2 - wolf 从 SQLite 读取所有 `selected: true` 且（`status: scored` 或 `status: tailor_error`）的职位（若设置了 `--jobid` 则仅读取指定职位），提取 JD、公司、职位名等相关字段。
- 3 - wolf 从 profile 文件夹下的 `profile.toml` 读取用户 profile，从同一文件夹下的 `resume_pool.md` 读取简历要点。
- 4 - wolf 将所有职位批量提交至 Claude Batch API，每个请求包含 JD 文本和简历池。CLI 在轮询时提供进度更新。
   - 4.1 - 若设置了 `--jobid` → 跳过批次，改为单次同步调用。
   - 4.2 - 若响应缺失或完全不可读（非有效 `.tex`）→ 标记 `status: tailor_error`，继续处理下一条。部分或可编译（但有瑕疵）的 `.tex` 进入步骤 5，由编译和审查循环（步骤 6–8）处理。

以下步骤（5–8）在收到批次结果后逐职位执行，每个职位独立进行审查循环。

- 5 - wolf 将定制后的 `.tex` 文件写入工作区。
- 6 - wolf 通过 `xelatex` 将 `.tex` 编译为 PDF。
   - 6.1 - 若未安装 `xelatex` → 跳过所有职位的步骤 6–8，打印警告，继续至步骤 9。
   - 6.2 - 若编译失败 → 将 `.tex` 和错误日志发回 Claude 修复，然后重试编译。若仍失败 → 标记 `status: tailor_error`，跳至下一条职位。
- 7 - wolf 对 PDF 截图：每页 1 张 JPG，最多截取 2 页。
- 8 - wolf 将截图和 `.tex` 源码发送给 Claude，指令为："如果你发现了第二页或孤行，请以最小改动修复 `.tex` 并返回更新后的源码；否则返回 LGTM。"
   - 8.1 - 若 Claude 返回更新后的 `.tex` → 返回步骤 6。在步骤 6–8 中最多重复 **3 次**。
   - 8.2 - 若 Claude 返回 LGTM → 继续处理下一条职位。
   - 8.3 - 3 次后仍未获得 LGTM → wolf 检查最终 PDF 页数：1 页则接受并继续；2 页则标记 `status: tailor_error`，继续处理下一条。
- 9 - wolf 打印汇总：已定制职位数、错误数和输出文件路径。
- 10 - 若设置了 `--cover-letter` → 为本批次所有定制成功的职位运行 UC-07.1.1。

## UC-06.1.2 · 定制简历（MCP）

**Actor：** AI Agent
**前置条件：** `wolf.toml` 存在；active `profile.toml` 存在；`resume_pool.md` 存在；目标职位在 DB 中。

- 1 - 用户要求 AI 为某职位定制简历（例如"帮我为职位 42 定制简历"）。
- 2 - AI 携带 `{ jobId }` 调用 `wolf_tailor` 定制指定职位，或无参数调用以定制所有已选职位。`profileId` 为未来多 profile 支持的占位参数（TBD）；目前省略。
- 3 - wolf 按 UC-06.1.1 步骤 2–10 执行定制，并返回每条职位的结果：PDF 路径、页数、视觉审查迭代次数、求职信路径（若已生成），以及错误信息（`tailor_error` 职位附带原因）。
- 4 - AI 向用户汇报摘要：哪些职位定制成功，哪些遇到 `tailor_error` 及原因，并提示下一步（例如运行 `wolf_cover_letter` 或 `wolf_fill`）。

## UC-07.1.1 · 生成求职信（`wolf cover-letter`）

**Actor：** User
**前置条件：** 目标职位在 DB 中；该职位的定制简历已生成。

- 1 - （从 UC-06.1.1 设置了 `--cover-letter` 时进入，或用户直接运行 `wolf cover-letter [--jobid <jobId>]`，或在 UC-08.1.1 检测到表单有求职信字段且无现有求职信时自动触发。）
- 2 - wolf 读取 evaluations 中没有现有求职信路径的所有已选职位（若设置了 `--jobid` 则仅读取指定职位）。对每条职位，wolf 读取 JD、用户 profile 和定制简历。
- 3 - wolf 检查 JD 或 `companies` 表中是否包含公司描述。
   - 3.1 - 若有公司描述 → 生成完整求职信，包含"为什么选择这家公司"章节。
   - 3.2 - 若无公司描述 → 求职信仅围绕用户自身和职位匹配度展开；省略"为什么选择这家公司"章节，不捏造内容。
- 4 - wolf 调用 Claude API 起草求职信。
- 5 - wolf 将草稿保存为 `.md` 文件（与定制简历放在同一位置），并在 `evaluations.coverLetterPath` 中记录路径。
- 6 - wolf 通过 `md-to-pdf` 将 `.md` 转换为 PDF。若未安装 `md-to-pdf` → 跳过所有职位的 PDF 转换，打印警告并继续。
- 7 - wolf 打印输出文件路径。

## UC-07.1.2 · 生成求职信（MCP）

**Actor：** AI Agent
**前置条件：** 目标职位在 DB 中；该职位的定制简历已生成。

- 1 - 用户要求 AI 生成求职信（例如"为职位 42 写一封求职信"），或 AI 在 UC-08.1.2 检测到求职信字段时自动触发。
- 2 - AI 携带 `{ jobId }` 调用 `wolf_cover_letter`。`profileId` 为未来多 profile 支持的占位参数（TBD）；目前省略。
- 3 - wolf 按 UC-07.1.1 步骤 2–6 生成求职信，并返回求职信内容、`.md` 路径、PDF 路径（若转换成功）以及是否有公司上下文。
- 4 - AI 向用户展示求职信内容供审阅。
   - 4.1 - 若用户请求修改 → AI 携带修改指令再次调用 `wolf_cover_letter`；从步骤 4 重复。

## UC-08.1.1 · 填写申请表（`wolf fill`）

> TODO：填表流程复杂，完整设计暂缓。

**去重行为（已决定，不暂缓）：**

填表前，wolf 检查职位当前状态。若为 `applied`、`applied_previously`、`interview` 或 `offer` → 跳过并警告，不重新提交。

填表过程中，若 ATS 提示该职位已申请过（如"您已申请过此职位"）：
- wolf 将状态设为 `applied_previously`，`appliedProfileId` 设为 `null`。
- wolf 警告用户并跳过提交。
- 统计时，此类职位与 wolf 正常提交的 `applied` 分开计数。

## UC-08.1.2 · 填写申请表（MCP）

> TODO：填表流程复杂，完整设计暂缓。

**去重行为：** 同 UC-08.1.1。`wolf_fill` MCP tool 在 ATS 报告已申请时返回 `{ skipped: true, reason: "already_applied", jobId }`，供 AI 向用户说明情况。

## UC-09.1.1 · 发送外联邮件（`wolf reach`）

> TODO：外联流程复杂，设计暂缓。

## UC-09.1.2 · 发送外联邮件（MCP）

> TODO：外联流程复杂，设计暂缓。

## UC-10.1 · 添加 Profile（`wolf profile add`）

> TODO

## UC-10.2 · 编辑 Profile（`wolf profile edit`）

> TODO

## UC-10.3 · 删除 Profile（`wolf profile delete`）

> TODO

## UC-10.4 · 备份工作区（`wolf backup`）

> TODO

## UC-12 · 管理环境变量（`wolf env`）

**Actor：** User
**备注：** 仅 CLI — env key 在 shell 层面管理，不在 MCP 服务器内部处理。

**变体 — show（`wolf env show`）：**

- 1 - wolf 从当前环境读取所有 `WOLF_*` key。
- 2 - 对每个 key：
   - 2.1 - 若已设置 → 打印 key 名和掩码值（前 4 位 + 后 4 位）。
   - 2.2 - 若未设置 → 打印 key 名并标记为"未设置"。

**变体 — clear（`wolf env clear`）：**

- 1 - wolf 扫描 shell RC 文件，查找 `WOLF_*` export 行。
   - 1.1 - 若未找到 RC 文件 → 打印警告并退出，不修改任何文件。
- 2 - wolf 从 RC 文件中删除这些行。
- 3 - wolf 为每个已删除的 key 打印 `unset WOLF_<KEY>` 命令（供用户在当前 session 中手动执行）。

## UC-13 · 端到端 Agent 工作流（MCP）

**Actor：** Agent（如 OpenClaw）
**前置条件：** wolf MCP 服务器正在运行且 `cwd` 正确；工作区已初始化。

- 1 - Agent 调用 `wolf_hunt`。wolf 获取并保存新职位；返回汇总。
- 2 - Agent 无参数调用 `wolf_score`。wolf 对所有待评分职位评分；返回每条职位的结果。
   - 2.1 - Agent 过滤掉分数低于阈值的职位。
- 3 - Agent 携带 `{ minScore: <threshold>, selected: false }` 调用 `wolf_list`，将带编号的结果展示给用户。
- 4 - 用户告知 Agent 要选择哪些职位（例如"职位 1、3、5"）。Agent 携带 `{ jobIds: [...], action: "select" }` 调用 `wolf_select`。
- 5 - 对每个已选职位，Agent 携带 `{ jobId }` 调用 `wolf_tailor`。wolf 返回定制简历 PDF 路径和改动摘要。
- 6 - Agent 携带 `{ jobId, dryRun: false }` 调用 `wolf_fill`。
- 7 - wolf 填写并提交表单；返回截图和更新后的状态。
- 8 - Agent 携带 `{ company, jobId, send: true }` 调用 `wolf_reach`。
- 9 - wolf 发送外联邮件；返回确认。
