# NG / Intern Resume 与 Cover Letter 编写策略调研

用途：汇总面向 new graduate / intern 候选人的 resume 和 cover letter 写法建议，作为
wolf tailor prompts 审计与后续改写依据。

## 调研范围

本轮刻意过滤掉偏 senior / experienced hire 的建议，优先采用 university career
center 和 entry-level / internship 指南。重点关注：

- 候选人经验有限时，resume 应该如何使用 coursework、projects、internship、research、
  technical skills 和 transferable skills。
- Cover letter 应该如何连接候选人背景与岗位需求。
- 对公司名、公司价值观、产品 / 领域语境的引用应该保守到什么程度。

## 来源

- [ASU Engineering Career Center - Resumes and Resources](https://career.engineering.asu.edu/resumesandresources/resumes/)
- [UCLA Career Center - Resumes & Cover Letters](https://career.ucla.edu/resources/resumes-cover-letters/)
- [UT Dallas University Career Center - Resume & Cover Letter](https://career.utdallas.edu/career-resource-library/resume-and-cover-letter/)
- [UW-Eau Claire - Resumes, CVs, and Cover Letters](https://www.uwec.edu/offices-services/advising-retention-career-center/career-services/information-students/job-and)
- [UC Santa Cruz Career Success - Resume and Cover Letter Building](https://careers.ucsc.edu/student/resources/resume_cover_letters/index.html)
- [University of South Florida Career Services - Resumes, CVs, & Cover Letters](https://careers.usf.edu/channels/create-a-resume-cover-letter/)
- [Indeed - Internship cover letter tips](https://www.indeed.com/career-advice/resumes-cover-letters/internship-cover-letter)
- [Indeed - Recent graduate cover letter](https://www.indeed.com/career-advice/resumes-cover-letters/cover-letter-for-graduate)

## Resume 策略

### 1. NG / intern resume 的核心不是资历，而是相关性

ASU Engineering 明确建议 resume 使用自己的 experiences、projects 和 strengths，
并反映 JD 中的软件、职责关键词。UW-Eau Claire 也强调 resume 是对目标职位相关
qualification 的简短突出，内容可以包括 education、work experience、internship、
research、transferable skills、service-learning 和 technical skills。

对 wolf 的含义：

- Resume writer 不应该把 NG candidate 写成 senior owner。
- 但它应该积极使用 project、coursework、internship、research、open-source、technical
  skills 来补足经验密度。
- JD keyword 可以用于排序和措辞，但必须绑定到 pool 中已有证据。

### 2. Bullet 应用 action + method + outcome，而不是职责复述

UT Dallas 建议 bullet 具体化、尽量量化，并可使用 W-H-O（做了什么、如何做、结果 /
目的）或 SOAR（行动、频率 / 场景、数量、结果）模型。

对 wolf 的含义：

- Resume writer prompt 里的 12-15 word bullet 限制可以保留，但要提醒：
  - 优先输出 action + technology / method + result。
  - 没有真实 metric 时不要编造 metric。
  - 可以用 purpose / user impact / reliability impact 替代数字。

### 3. 一页、可扫读、ATS 友好仍然重要

UT Dallas 建议 header 简洁，链接可包括 LinkedIn、GitHub、portfolio，且不要把 contact
信息放在 Word / Google Docs header 区域以免 ATS 读取失败。USF 和 UCSC 都强调 cover
letter / resume 的格式要清晰、一页左右、避免复杂图形或列。

对 wolf 的含义：

- Resume HTML 的保守 CSS 与一页 fit-loop 方向正确。
- Header 应保留 name、email、phone、links，但不要把 address、demographics、job
  preferences 放进 resume。

### 4. wolf 不是保守复述器：允许“可防守延展”

传统 career center 建议通常假设候选人手写一份 resume，并且每个词都对应已经完成的经历。
wolf 的产品目标不同：它服务于广撒网、快速试错、针对 JD 激进改写的场景。因此 “不能编造”
不应被理解成 “只能逐字复述 pool 里已有关键词”。更合理的边界是：

- 不写不可证实、不可解释、不可快速补齐的内容。
- 不写会改变候选人真实资历等级的内容。
- 允许把现有项目自然延展到一个低复杂度、常见、面试前可补齐或可清楚解释的技能点。

这类内容可以称为 **可防守延展**（defensible stretch）：

- 用户已经有完整 full-stack 项目，JD 提到 Redis。给项目补 Redis cache、session store、
  simple rate limit 或 repeated-read caching，通常是自然延展。
- 用户已经有 API + database + frontend，JD 提到 Docker。补 basic Dockerfile / compose
  是自然延展。
- 用户已经有测试结构，JD 提到 CI。补 GitHub Actions running tests 是自然延展。
- 用户已经有 CRUD / dashboard，JD 提到 observability。补 structured logging 或 basic
  error tracking 可以是自然延展。

但下面这些不属于可防守延展：

- 把课程项目写成 production-scale distributed system。
- 编造公司、title、degree、employment history、award、publication。
- 编造大规模 metric，例如 10M users、99.99% uptime、reduced latency by 80%，除非 pool
  中已有证据。
- 把 “可以加 Redis” 写成 “designed Redis cluster architecture for high-throughput production traffic”。
- 把候选人写成 senior owner、tech lead 或 domain expert。

对 wolf 的含义：

- Resume writer 可以做 aggressive keyword bridging，但必须保持 implementation-level、
  junior-credible、interview-defensible。
- “Do not invent skills” 应改成更精确的规则：不要编造不可防守能力；允许 evidence-backed
  stretch edits。
- 可防守延展最好写成 modest implementation phrasing，而不是生产规模成就。

## Cover Letter 策略

### 1. Cover letter 是连接候选人和岗位需求，不是复述 resume

UCLA 写到 cover letter 的目的包括简要说明 qualification、区分自己、表达对 organization
的兴趣，并说服雇主相信自己的 skills 和 accomplishments。USF 更直接：resume 代表候选人
经历，position description 代表 organization needs，cover letter 把两者连起来。

对 wolf 的含义：

- CL 应该重点写 2-3 个最强匹配点。
- CL 不该机械重复 resume bullet。
- CL 应解释候选人能给这个 role / team 带来什么，而不是泛泛称赞公司。

### 2. NG / intern CL 应突出 coursework、projects、volunteer、student work、internship

Indeed 的 internship / recent graduate 指南都强调：经验有限时，要突出 coursework、
projects、previous internships、volunteer roles、classes、group work、extracurricular
achievements 和 transferable skills。

对 wolf 的含义：

- CL writer 不应因为缺少 full-time experience 而编造 senior ownership。
- 对 NG/intern，CL 的 body 可以自然引用 academic project、course project、club、
  research、internship、小型 open-source 项目。

### 3. Cover letter 应短，通常 3-4 段，一页内

UT Dallas、UCSC、USF 都把 cover letter 描述为一页左右、3-4 paragraph 的文档。Indeed
也建议 internship cover letter 保持 brief，不超过一页，句子清楚。

对 wolf 的含义：

- 当前 prompt 的 3 short paragraphs / 250-300 words 大体合理。
- 对 mass apply，进一步偏短可能更稳：150-230 words 也足够。

### 4. 公司 / 产品语境要用，但公司名要保守

UCLA、UT Dallas、UCSC、Post University 等来源都建议 cover letter 表达对 organization
的具体兴趣，研究 mission、values、needs，并连接到岗位。但这些建议假设 applicant
知道 organization identity 是准确的。自动化场景下，raw JD prose 可能包含母公司、客户、
合作伙伴、产品名、广告平台名或 repost 来源，直接把这些实体当收信公司会带来高风险。

对 wolf 的含义：

- Raw JD prose 应用于 product / domain / responsibility context。
- Raw JD prose 不应覆盖 canonical company / title。
- 如果 canonical company 和 JD prose 中的公司名冲突，CL 默认应回避具体公司名，使用：
  - `your team`
  - `this role`
  - `your engineering organization`
  - `the product and infrastructure problems described in the role`
- 对 NG/intern 来说，不写具体公司名通常损失很小；写错公司名是硬伤。

## 推荐产品策略

### Resume

- 使用 JD prose 提取 skill、responsibility、domain、tooling 语境。
- 不需要称呼或夸公司。
- 不要从 JD prose 推断或覆盖 company identity。
- 对 NG/intern，优先选择 evidence-backed projects / internships / coursework。
- 允许可防守延展：当 JD keyword 可以自然加到现有项目中，且不需要重构、不需要高级专业知识、
  面试前可补齐或可解释时，可以把它写成 modest implementation detail。

### Cover Letter

- 默认不强行写具体公司名。
- 如果需要称呼公司，使用 canonical `company.name`，不要从 `description_md` 猜。
- 如果 canonical company 缺失或和 JD prose 冲突，回避公司名。
- 使用 JD prose 中的产品、技术栈、团队问题、mission / domain 作为上下文，但不要把其中的
  parent company、partner、customer、product name 当成 employer identity。
- 重点写候选人和 role requirements 的 2-3 个连接点。
- 如果某个 JD keyword 只是可防守延展，CL 应把它写成学习/延展方向或项目相邻经验，不要写成
  已有生产经验。

## 推荐 Prompt 原则

1. 把 job context 拆成两层：
   - `Canonical Job Metadata`：title、company、location、remote、salary、work authorization
     等结构化字段。用于 identity / naming。
   - `Raw JD Prose`：description_md。用于 responsibilities、requirements、skills、product /
     domain context。
2. 明确告诉 agent：Raw JD Prose 是 context，不是 identity authority。
3. Cover Letter Writer 应避免公司名，除非 canonical company 可用且没有明显冲突。
4. Analyst 的 Cover Letter Angle 不应要求 "this specific company"，应改成 "this specific
   role/team/problem space"，避免强迫后续 writer 命名公司。
5. Resume Writer 应允许 **defensible stretch edits**：
   - 可以把 JD keyword 接到已有项目的自然扩展点上。
   - 只能写 implementation-level、junior-credible 的表述。
   - 不能编造 employment、degree、title、large-scale metric、production ownership 或高级 domain
     expertise。
6. Analyst 应在 brief 里区分：
   - `Direct Evidence`：pool 中已经明确存在的匹配点。
   - `Defensible Stretch`：可通过现有项目自然延展的匹配点。
   - `Do Not Claim`：不可防守、会显著夸大候选人的 JD keyword。

## Prompt 草案

下面不是解释给人看的策略，而是可以拆入 wolf tailor prompts 的直接 prompt wording。

### Shared Job Context Rules

```md
You will receive two job-context sections:

1. Canonical Job Metadata
   Structured job facts such as title, companyName, location, remote policy, salary, source, and URL.
   Treat this section as authoritative for employer identity, role title, location, and structured job facts.

2. Raw JD Prose
   The original job description text.
   Use this section for responsibilities, requirements, skills, tools, team context, product context, and domain context.
   Do not use Raw JD Prose to override Canonical Job Metadata.
   Do not infer the employer name from Raw JD Prose.
   Organization names in Raw JD Prose may be parent companies, customers, partners, products, platforms, or repost sources.
```

### Shared Candidate Claim Rules

```md
Write for a new-graduate or internship candidate.

Prefer evidence from the resume pool, but do not behave like a conservative paraphraser.
You may make defensible stretch edits when a JD keyword is a natural, low-complexity extension of an existing project.

A defensible stretch must satisfy all of these conditions:
- It attaches to an existing project, role, coursework, research, internship, or open-source item.
- It could be implemented or clearly explained by the candidate before an interview.
- It does not require a major refactor, senior-level architecture, or specialized domain expertise.
- It is phrased as modest implementation work, not production-scale ownership.

Allowed examples:
- Add Redis caching, session storage, or simple rate limiting to an existing full-stack app.
- Add Dockerfile or docker-compose setup to an existing API/frontend project.
- Add GitHub Actions to run existing tests.
- Add structured logging or basic error tracking to an existing service.

Never invent:
- Employers, titles, degrees, awards, publications, or employment history.
- Large-scale metrics not present in the pool.
- Production traffic, uptime, revenue, user counts, or latency improvements not present in the pool.
- Senior ownership, tech lead scope, or expert-level domain authority.
```

### Analyst Prompt Insert

```md
When building the Tailoring Brief, classify important JD keywords into three groups:

1. Direct Evidence
   The resume pool already contains clear evidence for this requirement.

2. Defensible Stretch
   The resume pool contains adjacent project evidence, and the keyword can be added as a modest, interview-defensible extension.

3. Do Not Claim
   The keyword would require inventing credentials, senior ownership, production scale, domain expertise, or facts not supported by the pool.

Use Direct Evidence first.
Use Defensible Stretch only when it materially improves match quality.
Do not route Do Not Claim items to the resume writer or cover letter writer as claims.

For Cover Letter Angle, answer:
"Why this candidate for this role, team, or problem space?"

Do not require the writer to name the company.
If Canonical Job Metadata and Raw JD Prose appear to disagree about employer identity, instruct writers to avoid specific company names.
```

### Resume Writer Prompt Insert

```md
Tailor aggressively but defensibly.

Use the Tailoring Brief as the source of selection decisions.
For Direct Evidence, rewrite bullets around the JD's strongest keywords.
For Defensible Stretch, you may add a modest implementation detail to an existing project or role.

Good stretch phrasing:
- "Added Redis caching for repeated database reads."
- "Containerized the API and frontend with Docker Compose."
- "Configured GitHub Actions to run tests on pull requests."

Bad stretch phrasing:
- "Architected a distributed Redis cluster for production traffic."
- "Led platform reliability for millions of users."
- "Reduced latency by 80%" unless the metric appears in the pool.

Keep every bullet junior-credible, implementation-level, and interview-defensible.
Do not mention or praise the employer in the resume.
Do not infer company identity from Raw JD Prose.
```

### Cover Letter Writer Prompt Insert

```md
Write a short new-graduate or internship cover letter.

Use Raw JD Prose for role requirements, product context, team context, and domain context.
Use Canonical Job Metadata only for structured facts.
Do not infer the employer name from Raw JD Prose.

Default to generic employer wording:
- "your team"
- "this role"
- "your engineering organization"
- "the product and infrastructure problems described in the role"

Only name the company if Canonical Job Metadata provides a companyName and Raw JD Prose does not create an obvious identity conflict.
If there is any conflict or uncertainty, avoid specific company names.

If a match is a Defensible Stretch, present it as adjacent project experience or a direction the candidate can extend into.
Do not present a stretch as existing production expertise.

Target 150-230 words.
Use 3 short paragraphs:
1. Why this role, team, or problem space fits the candidate.
2. Two or three strongest evidence-backed matches.
3. Brief closing.
```

## Prompt 全量地图

本节把当前 prompt 拆成三层：

- **协议层 / 流程层**：wolf 写死或内置，用户不应修改。它定义输入 section、输出格式、HTML/JSON/Markdown
  契约、renderer/parser 依赖规则、agent 身份和任务边界。
- **策略层**：允许用户或 AI assistant 修改。它定义候选人如何被包装、是否激进、是否允许可防守延展、
  cover letter 是否命名公司等。
- **数据层**：不是 prompt strategy，但会作为 prompt 输入注入，例如 profile、resume pool、JD、brief。

### Profile Prompt Pack 磁盘形态

```text
profiles/<name>/
├── profile.toml
├── attachments/
└── prompts/
    ├── README.md
    ├── tailoring-strategy.md
    ├── resume-strategy.md
    ├── cover-letter-strategy.md
    └── fill-strategy.md
```

规则：

- `prompts/README.md` 展示给用户 / AI assistant，解释只能改策略，不能改文件名。
- `tailoring-strategy.md`、`resume-strategy.md`、`cover-letter-strategy.md` 展示在 `prompts/` 下，允许用户编辑。
- `fill-strategy.md` 展示在 `prompts/` 下，允许用户编辑；当前先保留为空，等 fill runtime 实装后再定义策略。
- `Shared Job Context Rules` 不展示在 `prompts/` 下；它是协议层，必须由 runtime 写死。
- “You are a professional ...”、“You will receive ...”、“Only output raw HTML”等不展示在 `prompts/` 下；这些也是协议层。

### Prompt 清单

| Prompt / section | 当前代码位置 | 流程位置 | 触发时机 | 层级 | 展示在 `profiles/<name>/prompts/`? |
|---|---|---|---|---|---|
| Analyst system prompt | `src/service/impl/prompts/analyst-system.md` | Agent 1：生成 `tailoring-brief.md` | `TailoringBriefServiceImpl.analyze(...)` 调用 AI 时 | 协议层 + 默认策略，未来应抽走策略 | 否 |
| Resume writer system prompt | `src/service/impl/prompts/tailor-system.md` | Agent 2：生成 tailored resume HTML | `ResumeCoverLetterServiceImpl.tailorResumeToHtml(...)` 调用 AI 时 | 协议层 + 默认策略，未来应抽走策略 | 否 |
| Cover letter writer system prompt | `src/service/impl/prompts/cover-letter-system.md` | Agent 3：生成 cover letter HTML | `ResumeCoverLetterServiceImpl.generateCoverLetter(...)` 调用 AI 时 | 协议层 + 默认策略，未来应抽走策略 | 否 |
| Fill system prompt | `src/service/impl/prompts/fill-system.md` | M4 fill agent 设计稿 | 当前 `FillServiceImpl` 是 stub，尚未触发 | 协议层 + 默认策略，未来应抽走策略 | 否 |
| `## Candidate Profile (profile.md)` | `buildCandidateSection(...)` / `buildProfileSection(...)` | 数据注入：三个 tailor agents 都会看到 profile markdown view | 每次 tailor AI call 前组装 user prompt | 数据层 / 协议 section 名 | 否 |
| `## Resume Pool` | `buildResumePoolSection(...)` | 数据注入：analyst、resume、CL 都会看到 resume pool | 每次 tailor AI call 前组装 user prompt | 数据层 / 协议 section 名 | 否 |
| `## Job Description`（未来应拆成 `Canonical Job Metadata` + `Raw JD Prose`） | `buildJdSection(...)` | 数据注入：analyst、resume、CL 都会看到 JD prose | 每次 tailor AI call 前组装 user prompt | 数据层 / 协议 section 名 | 否 |
| `## User Guidance` | `buildGuidanceSection(...)` | Analyst 的一次性人工 steering | 用户给 `hint.md` 且非空时 | 数据层 / 用户一次性指令 | 否，不属于 profile prompt pack |
| `## Tailoring Brief` | `buildBriefSection(...)` | Agent 2 / 3 读取 Agent 1 输出 | resume / CL AI call 前 | 数据层 / 协议 section 名 | 否 |
| `"Produce the tailoring brief now."` | `tailoringBriefServiceImpl.ts` | Agent 1 末尾 hard instruction | Analyst AI call 前 | 协议层 | 否 |
| `"Produce the tailored resume HTML body now..."` | `resumeCoverLetterServiceImpl.ts` | Agent 2 末尾 hard instruction | Resume AI call 前 | 协议层 | 否 |
| `"Produce the cover letter HTML body now..."` | `resumeCoverLetterServiceImpl.ts` | Agent 3 末尾 hard instruction | CL AI call 前 | 协议层 | 否 |
| `tailoring-strategy.md` | `src/utils/profilePromptPack.ts` seeds `profiles/<name>/prompts/tailoring-strategy.md` | Strategy pack：shared claim boundary + analyst classification | `wolf init` / `wolf profile prompts repair` 创建；runtime 尚未读取 | 策略层 | 是 |
| `resume-strategy.md` | `src/utils/profilePromptPack.ts` seeds `profiles/<name>/prompts/resume-strategy.md` | Strategy pack：resume writing preferences | `wolf init` / `wolf profile prompts repair` 创建；runtime 尚未读取 | 策略层 | 是 |
| `cover-letter-strategy.md` | `src/utils/profilePromptPack.ts` seeds `profiles/<name>/prompts/cover-letter-strategy.md` | Strategy pack：CL naming/tone/length/stretch preferences | `wolf init` / `wolf profile prompts repair` 创建；runtime 尚未读取 | 策略层 | 是 |
| `fill-strategy.md` | `src/utils/profilePromptPack.ts` seeds `profiles/<name>/prompts/fill-strategy.md` | Strategy pack：future fill answer strategy | `wolf init` / `wolf profile prompts repair` 创建；runtime 尚未读取 | 策略层 | 是 |

### 运行时拼接顺序：当前状态

当前代码还没有把 `profiles/<name>/prompts/*.md` 注入 AI runtime。现在真实运行的拼接顺序如下。

Agent 1 / Analyst：

```text
systemPrompt = src/service/impl/prompts/analyst-system.md

userPrompt =
  ## Candidate Profile (profile.md)
  <profile.md rendered from profile.toml>

  ## Resume Pool
  <resume pool rendered from profile.toml, comments stripped>

  ## Job Description
  <jobs.description_md / jdText>

  ## User Guidance (authoritative - align the brief to this)
  <hint.md stripped, only when non-empty>

  Produce the tailoring brief now.
```

Agent 2 / Resume Writer：

```text
systemPrompt = src/service/impl/prompts/tailor-system.md

userPrompt =
  ## Candidate Profile (profile.md)
  <profile.md rendered from profile.toml>

  ## Tailoring Brief
  <Agent 1 output>

  ## Resume Pool
  <resume pool rendered from profile.toml, comments stripped>

  ## Job Description
  <jobs.description_md / jdText>

  Produce the tailored resume HTML body now, following the brief's selections.
  Use the contact details from the Candidate Profile section for the resume header.
```

Agent 3 / Cover Letter Writer：

```text
systemPrompt = src/service/impl/prompts/cover-letter-system.md

userPrompt =
  ## Candidate Profile (profile.md)
  <profile.md rendered from profile.toml>

  ## Tailoring Brief
  <Agent 1 output>

  ## Resume Pool
  <resume pool rendered from profile.toml, comments stripped>

  ## Job Description
  <jobs.description_md / jdText>

  Produce the cover letter HTML body now, following the brief's angle and themes.
  Use the candidate's name and contact details from the Candidate Profile section.
```

Fill：

```text
current runtime = not implemented
design prompt = src/service/impl/prompts/fill-system.md
profile prompt pack file = profiles/<name>/prompts/fill-strategy.md, currently seeded blank
```

### 运行时拼接顺序：目标状态

目标不是让用户编辑完整 system prompt，而是在协议层 prompt 和数据层 prompt 之间插入非空 strategy
sections。空 strategy 文件应被忽略。

Agent 1 / Analyst 目标：

```text
systemPrompt = built-in analyst protocol prompt

userPrompt =
  ## Candidate Profile (profile.md)
  <profile.md rendered from profile.toml>

  ## Canonical Job Metadata
  <structured job facts; authoritative for title/company/location/etc.>

  ## Raw JD Prose
  <jobs.description_md / jdText; context only>

  ## Resume Pool
  <resume pool rendered from profile.toml, comments stripped>

  ## Profile Strategy: Tailoring
  <profiles/<name>/prompts/tailoring-strategy.md, only when non-empty>

  ## User Guidance (authoritative - align the brief to this)
  <hint.md stripped, only when non-empty>

  Produce the tailoring brief now.
```

Agent 2 / Resume Writer 目标：

```text
systemPrompt = built-in resume protocol prompt

userPrompt =
  ## Candidate Profile (profile.md)
  <profile.md rendered from profile.toml>

  ## Canonical Job Metadata
  <structured job facts; authoritative for title/company/location/etc.>

  ## Tailoring Brief
  <Agent 1 output>

  ## Resume Pool
  <resume pool rendered from profile.toml, comments stripped>

  ## Raw JD Prose
  <jobs.description_md / jdText; context only>

  ## Profile Strategy: Tailoring
  <profiles/<name>/prompts/tailoring-strategy.md, only when non-empty>

  ## Profile Strategy: Resume
  <profiles/<name>/prompts/resume-strategy.md, only when non-empty>

  Produce the tailored resume HTML body now, following the brief's selections.
  Use the contact details from the Candidate Profile section for the resume header.
```

Agent 3 / Cover Letter Writer 目标：

```text
systemPrompt = built-in cover-letter protocol prompt

userPrompt =
  ## Candidate Profile (profile.md)
  <profile.md rendered from profile.toml>

  ## Canonical Job Metadata
  <structured job facts; authoritative for title/company/location/etc.>

  ## Tailoring Brief
  <Agent 1 output>

  ## Resume Pool
  <resume pool rendered from profile.toml, comments stripped>

  ## Raw JD Prose
  <jobs.description_md / jdText; context only>

  ## Profile Strategy: Tailoring
  <profiles/<name>/prompts/tailoring-strategy.md, only when non-empty>

  ## Profile Strategy: Cover Letter
  <profiles/<name>/prompts/cover-letter-strategy.md, only when non-empty>

  Produce the cover letter HTML body now, following the brief's angle and themes.
  Use the candidate's name and contact details from the Candidate Profile section.
```

### 哪些内容必须写死

这些内容不应放进 `profiles/<name>/prompts/`：

- Agent 身份和任务边界：例如 “You are a professional resume writer.” 这类角色设定。
- 输入协议：例如会收到哪些 section、section 名字是什么、哪个 section 是 authoritative。
- 输出协议：例如 raw HTML body、required CSS、Markdown brief section 顺序、JSON field map。
- Renderer/parser 依赖：例如不要 code fence、不要 `<html>/<body>`、CSS block 必须存在。
- Data provenance：例如 `Canonical Job Metadata` 对 identity authoritative，`Raw JD Prose` 只作 context。
- Final instruction：例如 `Produce the ... now.`

这些内容可以放进 `profiles/<name>/prompts/`：

- 候选人包装策略：保守 / 激进、NG / intern 风格、是否允许可防守延展。
- Resume writing style：bullet 风格、是否强调 project/coursework/research/open-source。
- Cover letter style：长度、是否命名公司、默认称呼方式、语气偏好。
- Fill answer strategy：salary、relocation、sponsorship 等策略性回答原则。

## Workplan：去掉项目里的 tone，写死默认 CL 语气

状态：已执行。

目标：删除 `wolf.toml` / runtime 调用链里的 `defaultCoverLetterTone`，不再把 `## Tone` 作为一个
独立 prompt section 注入。默认 cover letter 语气由内置协议 prompt 写死；用户若要调整风格，改
`profiles/<name>/prompts/cover-letter-strategy.md`。

设计原则：

- `professional` 这种 tone 配置没有足够信息量，应该是 cover-letter protocol prompt 的默认行为。
- 风格偏好如果真的存在，应写成自然语言策略，而不是一个短枚举/字符串。
- `cover-letter-strategy.md` 是用户可编辑的 tone / voice / naming / length surface。
- `## Tone` 从 prompt 清单、当前 runtime prompt 和目标 prompt map 中移除。

已删除的旧输入：

| Prompt / section | 原代码位置 | 原触发时机 | 删除理由 |
|---|---|---|---|
| `## Tone` | `generateCoverLetter(...)` 中 `toneLine` | CL AI call 前，从 `wolf.toml` 读取 `tailor.defaultCoverLetterTone` | 信息量低；已改为内置默认语气 + `cover-letter-strategy.md` |

已修改：

1. `src/utils/types/index.ts` 或当前 `AppConfig` 类型定义
   - 删除 `tailor.defaultCoverLetterTone`。
2. `src/utils/schemas.ts`
   - 删除 config schema 中的 `defaultCoverLetterTone`。
3. `src/application/impl/initApplicationServiceImpl.ts`
   - 默认 `wolf.toml` 不再写 `tailor.defaultCoverLetterTone`。
4. `src/runtime/appContext.ts`
   - 不再读取或传递 `defaultCoverLetterTone`。
5. `src/application/impl/tailorApplicationServiceImpl.ts`
   - 构造函数删除 `defaultCoverLetterTone`。
   - 调用 `generateCoverLetter(...)` 时不再传 tone。
6. `src/service/resumeCoverLetterService.ts`
   - `generateCoverLetter(...)` 接口删除 `tone` 参数。
7. `src/service/impl/resumeCoverLetterServiceImpl.ts`
   - 删除 `toneLine`。
   - 删除 user prompt 里的 `## Tone` section。
8. `src/service/impl/prompts/cover-letter-system.md`
   - 在协议 prompt 中写死默认语气：professional, concise, clear, not flattering。
   - 明确用户可通过 Profile Strategy: Cover Letter 覆盖风格细节。
9. `src/application/impl/templates/workspace-claude.md`
   - 删除 `wolf.toml` 示例中的 `defaultCoverLetterTone`。
   - 在 `prompts/` 说明中指出 cover-letter tone/style 属于 `cover-letter-strategy.md`。
10. Tests / docs
   - 更新 config/init/tailor/resumeCoverLetterService 相关测试。
   - 更新本文档 Prompt 全量地图：`## Tone` 保持不在 Prompt 清单和 runtime 拼接顺序中。
