# 类型定义 — wolf

本文档定义了 wolf 各层共享的 TypeScript 类型。这些类型位于 `src/types/index.ts`，是 CLI、MCP、命令和存储层之间的契约。

可以把这个文件理解为整个项目的**数据字典**——如果你想知道一个"职位"或"用户档案"在内存里长什么样，来这里查就对了。

---

## 核心领域类型

### `JobStatus`

记录一个职位在你个人求职流程中所处的阶段，从首次发现到最终结果。wolf 用它来过滤、排序，以及判断哪些操作当前可用。

```typescript
type JobStatus = "new" | "reviewed" | "ignored" | "filtered" | "applied" | "interview" | "offer" | "rejected";
```

生命周期：

```
new  →  reviewed  →  applied  →  interview  →  offer
     →  ignored               →  rejected
     →  filtered  （自动，由 dealbreaker 规则触发）
```

- `new`：wolf 刚找到，用户还没看过
- `reviewed`：用户看过了，没有忽略——下一步是投递
- `ignored`：用户手动不要的；保留在数据库中，方便后悔时找回
- `filtered`：wolf 的 dealbreaker 规则自动判定不合适（例如明确拒绝 sponsorship）；同样保留在数据库中可以找回——与 `ignored` 的区别在于：一个是你做的决定，一个是 wolf 做的
- `applied`：已提交申请
- `interview`：公司联系你进行面试
- `offer`：收到 offer
- `rejected`：公司拒绝，或用户自己撤回了

---

### `CompanySize`

用数字表示公司规模的分级，设计为可直接比较和排序。数字越大代表公司越大。

```typescript
type CompanySize = 1 | 2 | 3 | 4;
// 1 = startup   （<50 人）
// 2 = small     （50–500 人）
// 3 = mid       （500–5000 人）
// 4 = bigtech   （5000+ 人）
```

用数字表示的好处是可以直接写比较逻辑，例如 `companySize >= 3`（mid 及以上）。

---

### `Company`

公司是一个独立的实体，与职位分开存储。这样做的好处：
- 多个职位共享同一家公司的记录，不重复存储规模、domain 等信息
- 用户可以独立于某个具体职位，将某家公司加入目标列表（例如专门盯着 TikTok 的招聘）
- `reach` 命令可以利用 `domain` 字段推断邮箱模式

```typescript
interface Company {
  id: string;                         // 唯一 ID（uuid）
  name: string;                       // 例如 "TikTok"、"Google"
  domain: string | null;              // 例如 "tiktok.com"——用于 reach 命令推断邮箱
  linkedinUrl: string | null;         // 公司 LinkedIn 主页 URL
  size: CompanySize | null;           // 公司规模分级；未知则为 null
  industry: string | null;            // 例如 "Software"、"Finance"、"Healthcare"
  headquartersLocation: string | null; // 例如 "Mountain View, CA"
  notes: string | null;               // 用户对这家公司的个人备注
  createdAt: string;                  // ISO 8601 时间戳
  updatedAt: string;                  // ISO 8601 时间戳
}
```

---

### `Salary`

年薪（美元），或字面量字符串 `"unpaid"`（用于实习或志愿者职位）。使用联合类型确保代码必须显式处理"无薪"这种情况，而不是用 0 来含糊表示。

```typescript
type Salary = number | "unpaid";
```

---

### `JobSource`

wolf 从哪里找到这个职位。用于筛选和调试。

```typescript
type JobSource = "linkedin" | "handshake" | "email" | "browser_mcp" | "manual";
```

- `linkedin` / `handshake`：通过 Apify 抓取
- `email`：从转发的招聘邮件中解析
- `browser_mcp`：由外部 Agent 浏览网页时发现
- `manual`：用户自己手动添加

---

### `Job`

核心数据对象。每条职位信息对应 SQLite 中的一行。wolf 的每个命令都在读取或写入 `Job` 记录。

```typescript
interface Job {
  id: string;                              // 唯一 ID（uuid）
  title: string;                           // 例如 "Software Engineer Intern"
  companyId: string;                       // 引用 Company.id
  url: string;                             // 申请或列表 URL
  source: JobSource;                       // 职位来源
  description: string;                     // 完整 JD 文本
  location: string;                        // 例如 "New York, NY"——该职位的具体办公地点
  remote: boolean;                         // 是否为远程职位
  salary: Salary | null;                   // 年薪（美元）、"unpaid"，或未列出则为 null
  workAuthorizationRequired: string | null; // 例如 "no sponsorship"、"sponsorship available"、"US citizens only"
  score: number | null;                    // AI 相关性评分 0.0–1.0，未评分则为 null
  scoreJustification: string | null;       // AI 对评分的解释
  status: JobStatus;
  appliedProfileId: string | null;         // 投递时使用的 profile ID；未投递则为 null
  tailoredResumePath: string | null;       // 定制简历 .tex 文件路径
  tailoredResumePdfPath: string | null;    // 编译后的简历 PDF 路径
  coverLetterPath: string | null;          // 求职信 .md 文件路径
  coverLetterPdfPath: string | null;       // 求职信 PDF 路径
  screenshotPath: string | null;           // 表单填写截图路径
  outreachDraftPath: string | null;        // 外联邮件草稿路径
  createdAt: string;                       // ISO 8601 时间戳
  updatedAt: string;                       // ISO 8601 时间戳
}
```

`companyId` 是指向 `Company` 表的外键。公司层面的属性（规模、domain、行业）存在 `Company` 上，不在这里——同一家公司的所有职位共享一条 `Company` 记录。

`workAuthorizationRequired` 从 JD 中提取，用于在评分时与 `UserProfile.immigrationStatus` 进行匹配。

`appliedProfileId` 记录投递时使用的身份（姓名、邮箱、身份状态），这样 wolf 在后续跟进时知道该用哪个 profile。

---

### `Resume`

解析后的结构化简历。wolf 在 tailor 时需要读懂简历的结构（各 section、要点），才能根据具体 JD 智能改写。

base `.tex` 文件中的联系方式 header 被视为**占位内容**。生成定制简历时，wolf 始终用所选 `UserProfile` 的姓名、邮箱、电话覆盖 header——因此多个 profile 可以共享同一个 base `.tex` 文件，不会出现信息不一致的问题。

```typescript
interface ResumePlainSection {
  heading: string;            // 例如 "Summary"、"Objective"
  content: string;            // 纯文本正文（无条目列表）
}

interface ResumeSection {
  heading: string;            // 例如 "Education"、"Experience"、"Skills"
  items: ResumeSectionItem[];
}

interface ResumeSectionItem {
  title: string | null;       // 例如 "Software Engineer Intern"；无标题的条目为 null
  subtitle: string | null;    // 例如 "Google"
  location: string | null;    // 例如 "Mountain View, CA"
  date: string | null;        // 例如 "Jun 2025 – Aug 2025"
  bullets: string[];          // 要点描述
}

interface Resume {
  name: string;
  contactInfo: {
    email: string;
    phone: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
  sections: (ResumeSection | ResumePlainSection)[];
  rawTex: string;             // 原始 .tex 源码
}
```

`ResumePlainSection` 用于 Summary、Objective 等没有结构化条目的自由文本 section。

---

### `UserProfile`

一套完整的求职身份。wolf 支持**多个 profile**，用于处理以下场景：

- 换邮箱/电话重投同一家公司，绕过 ATS 的重复检测
- 对不支持签证的公司填写不同的身份状态
- 在不同平台使用不同的名字变体

多个 profile 可以共享同一个 base `.tex` 简历文件——wolf 在生成时始终将 profile 的联系信息注入简历 header，所以简历内容和表单填写内容永远一致，不存在错位风险。

```typescript
interface UserProfile {
  id: string;                       // 唯一标识符，例如 "default"、"gc-persona"
  label: string;                    // 人类可读的名称，例如 "Default"、"Green Card"
  name: string;
  alternateName: string[];          // 例如 ["Gary Tao"] — 申请时使用的其他名字
  email: string;
  alternateEmail: string[];         // 备用邮箱地址
  phone: string;                    // 主要电话号码（必填）
  alternatePhone: string[];         // 备用电话号码
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  immigrationStatus: string;        // 例如 "US citizen"、"F-1 OPT"、"H-1B needed"（必填）
  currentCity: string | null;
  willingToRelocate: boolean;
  workAuthTimeline: string | null;  // 例如 "OPT starts May 2026"
  targetRoles: string[];            // 例如 ["Software Engineer", "Full Stack Developer"]
  targetLocations: string[];        // 例如 ["NYC", "SF", "Remote"]
  skills: string[];                 // 例如 ["TypeScript", "React", "Python"]
  resumePath: string;               // base 简历 .tex 文件路径（联系方式 header 由本 profile 注入）
  targetedCompanyIds: string[];     // 用户主动盯着的公司列表；这些公司的职位在评分时获得加分
  scoringPreferences: ScoringPreferences;
}
```

`immigrationStatus` 为必填项，因为它影响职位评分（与 `Job.workAuthorizationRequired` 匹配）。`phone` 为必填项，因为大多数申请表要求填写电话。

---

### `ScoringPreferences`

挂载在 `UserProfile` 上的评分配置，控制 wolf 如何评估职位。每个 profile 可以有不同的容忍度——比如 F-1 OPT profile 把 no sponsorship 设为硬过滤，而绿卡 persona 完全不用管这个字段。

评分使用**混合模型**：
- **AI** 负责 `roleMatch`（角色匹配度）：读取 JD，结合你的目标职位和技能打分。这需要语义理解，规则算法做不好。
- **算法** 负责其余结构化维度（身份匹配、地点、远程偏好）：用确定性规则计算，稳定可预测。
- **`weights`** 是算法层的加权系数，最终分数是各子分的加权平均。AI 看不到这些权重——它只输出自己的 `roleMatch` 子分。

```typescript
interface ScoringPreferences {
  // 评分锚点——算法用来衡量偏差的基准
  preferences: {
    minSalary: number | null;              // 可接受的最低年薪（美元）；null = 无要求
    preferredCompanySizes: CompanySize[];   // 例如 [3, 4] = mid 或 bigtech；空数组 = 无偏好
  };

  // 各维度对最终分数的贡献权重（各项 0.0–1.0，理想情况下总和为 1.0）
  weights: {
    workAuth: number;    // 身份匹配与 profile immigrationStatus 的偏差
    roleMatch: number;   // AI 的语义角色相关度子分
    location: number;    // 地点匹配与 profile targetLocations 的偏差
    remote: number;      // 远程偏好匹配度
    salary: number;      // 薪资与 preferences.minSalary 的偏差
    companySize: number; // 公司规模与 preferences.preferredCompanySizes 的接近程度
  };

  // 硬过滤——在评分前运行；触发则直接 status: "filtered"，不发起 AI 调用
  dealbreakers: {
    sponsorship: boolean | null;
    // true  = 必须提供 sponsorship（过滤掉"no sponsorship"的职位）——F-1/H-1B 用户
    // false = 必须不 sponsor（过滤掉提供 sponsorship 的职位）——GC/公民用户，竞争更少
    // null  = 不过滤
    remote: boolean | null;
    // true  = 必须是远程
    // false = 必须是现场办公
    // null  = 不过滤
  };
}
```

dealbreaker 检查在评分**之前**运行。触发 dealbreaker 的职位直接标为 `filtered`，不进入评分流程——节省 AI API 调用次数。

---

### `AppConfig`

wolf 启动时从 `~/.wolf/config.json` 加载的顶层配置对象。包含所有 profile、所有数据源配置，以及每个命令的默认行为。

```typescript
interface AppConfig {
  profiles: UserProfile[];           // 所有已定义的 profile；至少需要一个
  defaultProfileId: string;          // 未指定时默认使用哪个 profile
  providers: Record<string, ProviderConfig>;
  hunt: {
    minScore: number;                      // 最低分数阈值（默认 0.5）
    maxResults: number;                    // 每次 hunt 最大结果数（默认 50）
  };
  tailor: {
    defaultTemplatePath: string | null;    // 默认 LaTeX 简历模板；可在每次运行时覆盖
    defaultCoverLetterTone: string;        // 例如 "professional"、"conversational"；可在每次运行时覆盖
  };
  reach: {
    defaultEmailTone: string;             // 例如 "professional"、"casual"；可在每次运行时覆盖
    maxEmailsPerDay: number;              // 安全限制（默认 10）
  };
}

interface ProviderConfig {
  enabled: boolean;
  strategy?: string;           // provider 特定配置，例如 handshake 的 "email"
}
```

`default*` 字段是基准默认值，单次命令运行可通过选项覆盖。例如 `defaultCoverLetterTone` 设定了平时的语气，但某次 `wolf tailor` 运行时可以用 `--tone casual` 覆盖。

> **待定：** `ProviderConfig` 设计需进一步讨论——可能需要各 provider 各自的强类型配置，而非通用的 `strategy` 字符串。

---

## 命令输入 / 输出类型

每个 wolf 命令都有一个 `*Options` 类型（**输入**）和一个 `*Result` 类型（**输出**）。无论你从 CLI 还是 MCP 调用 wolf，用的都是同一套类型。

标记为 `?` 的字段是**可选的**：不传时，命令回退到配置默认值。这里用 `?`（可选）而非 `| null`（可为空）——"不传"的意思是"用默认值"，而 `null` 的意思是"明确设为空"，两者语义不同。

---

### `hunt`

`wolf hunt` 搜索已启用的职位来源，根据你的 profile 对结果评分，并将新职位存入数据库。

```typescript
interface HuntOptions {
  profileId?: string;          // 使用哪个 profile 的 targetRoles/targetLocations；默认用 defaultProfileId
  role?: string;               // 目标职位关键词；覆盖 profile.targetRoles
  location?: string;           // 目标地点；覆盖 profile.targetLocations
  companyIds?: string[];       // 只搜索这些公司的职位（例如只搜 TikTok 和 ByteDance）
  providers?: string[];        // 覆盖使用哪些 provider；默认使用所有已启用的 provider
  maxResults?: number;         // 覆盖 config.hunt.maxResults
}

interface HuntResult {
  jobs: Job[];
  newCount: number;            // 本次新发现（之前未见过）的职位数量
  avgScore: number;
}
```

---

### `tailor`

`wolf tailor` 读取某个职位的 JD，用 Claude 改写你的简历要点，使其与 JD 匹配。同时可选生成求职信。每个职位都会得到自己专属的定制输出——base 简历永远不会被修改。

```typescript
interface TailorOptions {
  jobId: string;               // 要定制的职位 ID
  profileId?: string;          // 用哪个 profile 注入联系方式；默认用 defaultProfileId
  resume?: string;             // 指定使用的 .tex 简历路径；默认使用所选 profile 的 resumePath
  coverLetter?: boolean;       // 是否同时生成求职信（默认 true）
  diff?: boolean;              // 显示修改前后对比
}
```

`resume?` 也支持"仅生成求职信"模式：传入一份已定制的简历路径并设置 `coverLetter: true`，即可跳过重新定制简历。

```typescript
interface TailorResult {
  tailoredTexPath: string | null;     // 输出 .tex 文件路径；如果未重新定制简历则为 null
  tailoredPdfPath: string | null;     // 编译后的简历 PDF 路径；如果未重新定制简历则为 null
  coverLetterMdPath: string | null;   // 求职信 .md 路径
  coverLetterPdfPath: string | null;  // 求职信 PDF 路径
  changes: string[];                  // 主要改动摘要
  matchScore: number;                 // 定制后的预估匹配分数
}
```

---

### `fill`（表单填写——自动填写并提交职位申请表单）

`wolf fill` 使用 Playwright 打开职位申请 URL，检测表单字段，从所选 profile 和定制文件中映射值，并可选地提交表单。可以把它理解为一个浏览器机器人，代替你填写申请表。

```typescript
interface FormField {
  name: string;                // 表单上显示的字段名称或标签
  type: string;                // "text"、"email"、"file"、"select"、"checkbox" 等
  required: boolean;
  value: string | null;        // 从用户资料映射的值；未能映射则为 null
}

interface FillOptions {
  jobId: string;               // 要申请的职位 ID
  profileId?: string;          // 用哪个 profile 填写表单字段；默认用 defaultProfileId
  dryRun?: boolean;            // 仅预览，不提交（默认 true）
  resumePath?: string;         // 指定上传的简历 PDF 路径；默认使用该职位的定制简历
  coverLetterPath?: string;    // 指定上传的求职信 PDF 路径；默认使用该职位的定制求职信
}

interface FillResult {
  fields: FormField[];
  submitted: boolean;
  screenshotPath: string | null;
}
```

---

### `reach`

`wolf reach` 为某个职位寻找 HR 或招聘经理，起草外联邮件，并可选地通过 Gmail 发送。

```typescript
interface Contact {
  name: string;
  title: string;               // 例如 "Engineering Manager"
  companyId: string | null;    // 引用 Company.id；若公司不在数据库中则为 null
  companyName: string;         // 冗余存储的公司名，用于显示——即使 companyId 为 null 也始终存在
  email: string | null;        // 真实或推断的邮箱
  emailInferred: boolean;      // 如果邮箱是从模式推测的则为 true（例如 first.last@company.com）
  linkedinUrl: string | null;
}

interface ReachOptions {
  jobId: string;               // 要进行外联的职位 ID
  profileId?: string;          // 用哪个 profile 的姓名/邮箱作为发件人；默认用 defaultProfileId
  send?: boolean;              // 是否实际发送邮件（默认 false）
}

interface ReachResult {
  contacts: Contact[];
  draftPath: string;           // 邮件草稿 .md 文件路径
  sent: boolean;
}
```

---

### `status`（职位追踪器——查询并汇总已追踪的职位）

`wolf status` 是**只读**查询命令。它从本地 SQLite 数据库读取数据，返回经过筛选的已追踪职位列表及汇总统计。不触发 AI 调用或外部请求——只展示 wolf 已知的信息。

```typescript
interface StatusOptions {
  status?: JobStatus;          // 按状态过滤
  companyIds?: string[];       // 只看指定公司的职位
  minScore?: number;           // 按最低分数过滤
  since?: string;              // 按 createdAt 日期过滤（ISO 8601）
}

interface StatusResult {
  jobs: Job[];
  total: number;
  byStatus: Record<JobStatus, number>;  // 各状态的职位数量，例如 { new: 12, applied: 3, ... }
}
```

---

## 存储 / CRUD 类型

存储层（`src/utils/db.ts`）内部使用的类型，用于在 SQLite 中查询和更新记录。不直接暴露给 CLI 或 MCP——命令处理器在读写数据库时内部使用。

```typescript
interface JobQuery {
  status?: JobStatus | JobStatus[];   // 按一个或多个状态过滤
  companyIds?: string[];              // 只查指定公司的职位
  minScore?: number;                  // 最低分数阈值
  since?: string;                     // 按 createdAt 过滤（ISO 8601）
  source?: JobSource;                 // 按来源过滤
  limit?: number;                     // 最大返回记录数
  offset?: number;                    // 分页偏移量（用于大量结果集）
}

interface JobUpdate {
  status?: JobStatus;
  appliedProfileId?: string | null;
  score?: number | null;
  scoreJustification?: string | null;
  tailoredResumePath?: string | null;
  tailoredResumePdfPath?: string | null;
  coverLetterPath?: string | null;
  coverLetterPdfPath?: string | null;
  screenshotPath?: string | null;
  outreachDraftPath?: string | null;
}
```

interface CompanyQuery {
  size?: CompanySize | CompanySize[];  // 按公司规模分级过滤
  industry?: string;                   // 按行业过滤
  limit?: number;
  offset?: number;
}

interface CompanyUpdate {
  name?: string;
  domain?: string | null;
  linkedinUrl?: string | null;
  size?: CompanySize | null;
  industry?: string | null;
  headquartersLocation?: string | null;
  notes?: string | null;
}
```

---

## Provider 接口

`JobProvider` 是使用**策略模式**的插件接口。每个职位来源（LinkedIn、Handshake 等）各自独立实现该接口。`wolf hunt` 运行时，遍历所有已启用的 provider，分别调用 `hunt()` 获取原始职位列表，再合并去重、统一评分。

关键优点：新增一个职位来源，只需写一个实现了 `JobProvider` 的新类，无需改动核心 hunt 逻辑。

```typescript
interface JobProvider {
  name: string;
  hunt(options: HuntOptions): Promise<Job[]>;
}
```

`hunt(options)` 是一个异步函数：你给它搜索参数，它去互联网抓取匹配的职位，并以 `Job[]` 数组的形式返回。`Promise<Job[]>` 表示结果是异步到达的（因为网络请求需要时间）。

内置 provider：`ApifyLinkedInProvider`、`ApifyHandshakeProvider`、`EmailProvider`、`BrowserMCPProvider`、`ManualProvider`。

---

## MCP Tool Schema

每个 MCP tool 直接映射到一个命令：

| MCP Tool | 输入类型 | 输出类型 |
|---|---|---|
| `wolf_hunt` | `HuntOptions` | `HuntResult` |
| `wolf_tailor` | `TailorOptions` | `TailorResult` |
| `wolf_fill` | `FillOptions` | `FillResult` |
| `wolf_reach` | `ReachOptions` | `ReachResult` |

MCP 输入/输出 schema 是这些 TypeScript 类型的 JSON Schema 表示，定义在 `src/mcp/tools.ts` 中。
