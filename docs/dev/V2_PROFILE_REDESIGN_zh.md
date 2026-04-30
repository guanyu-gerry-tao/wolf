# v2 Profile 重构 —— BFS 介绍

> v2 对应这一组 commit：α + β.1 → β.9（在 branch `feat/migration-runner-framework`）
>
> 这份 doc 用 BFS 思路一层一层展开。先看大局，再到每个 commit 干啥，再钻进具体细节。

## 大局观（layer 1）

整个 v2 干一件事：**把 v1 的"3 个 markdown 文件 + jd.md"换成 v2 的"1 个 profile.toml + jobs SQLite 列"**。

```
v1 workspace                          v2 workspace
─────────────                          ─────────────
profiles/default/                      profiles/default/
├── profile.md            ─┐           └── profile.toml      ← 1 个文件
├── resume_pool.md         │ ─merge→
└── standard_questions.md ─┘

data/jobs/<dir>/                       data/wolf.sqlite
└── jd.md                 ─migrate→    jobs.description_md   ← SQLite 列
```

要让这个换装平滑发生 + 之后能编辑/读，需要 9 个 commit 各司其职。

## 每个 commit 大致干啥（layer 2）

| commit | 一句话 |
|---|---|
| **α** | 建个"workspace 升级"的通用框架（schema_version + migrate runner），之后任何破坏性变更都用它 |
| **β.1** | **定义 v2 的数据形状**——TOML schema、模板、字段元数据、解析器 |
| **β.2** | 写"原地改 TOML 一个字段不破坏注释"的工具函数（surgical edit） |
| **β.3** | 用上面工具，写一个真实的 v1→v2 migration（旧 md trio → profile.toml） |
| **β.4** | 让 wolf 内部读 profile.toml + 渲染 markdown 给 tailor / fill 这些"还在用 markdown 接口的"消费者 |
| **β.5** | 暴露 `wolf profile show / get / set / add / remove / fields` 命令 |
| **β.6** | doctor 和 assertReadyForTailor 不再 grep markdown，直接读结构化的 ProfileToml |
| **β.7** | jd.md 文件 → `jobs.description_md` SQLite 列；migrate 顺手把老的 jd.md 吸进 SQLite |
| **β.8** | 加 `wolf context --for=search/tailor` 命令，给 AI agent 喂"任务相关的"profile 切片 |
| **β.9** | 重写 workspace-claude.md，让 AI agent 知道新的 v2 工作流 |

## β.1 详细解释（layer 3）

β.1 创建了 **4 个文件**，它们一起定义"profile 这玩意儿在 v2 里长啥样、怎么读、怎么验证"。

### 4 个文件的关系

```
profile.toml (template)        ← 数据：用户文件长这样
   │
   ├──"我有哪些字段？" ─────→  profileFields.ts (PROFILE_FIELDS)
   │                              负责回答"email 字段在哪？必填吗？为啥要填？"
   │
   ├──"用代码读这文件" ─────→  profileToml.ts (parseProfileToml + zod)
   │                              负责回答"读出来变成什么 TS 对象？合不合法？"
   │
   └──"有哪些预设故事？" ───→  storyFields.ts (WOLF_BUILTIN_STORIES)
                                   负责回答"17 条 behavioral 题分别是什么 id？"
```

### 1️⃣ `profile.toml` 模板 —— 用户磁盘上的形状

```toml
schemaVersion = 2

# REQUIRED — Wolf cannot guess this. Used as the resume header.
[identity]
legal_first_name = """

"""

# REQUIRED — Resume header & outreach From: address.
[contact]
email = """

"""

# 17 条预设 behavioral 故事，每条一块
[[story]]
id = "tell_me_about_failure"
prompt = """
Tell me about a time you failed
"""
required = true
star_story = """

"""
```

这是 wolf init 写到磁盘的文件。空，但结构齐全。注释是给用户看的提示。

### 2️⃣ `profileFields.ts` —— 字段的"说明书"

```ts
export const PROFILE_FIELDS = [
  { path: 'identity.legal_first_name', required: true,  type: 'multilineString',
    help: 'Used as the resume header.' },
  { path: 'contact.email',             required: true,  type: 'multilineString',
    help: 'Resume header & outreach From: address.' },
  // ... ~70 行
];
```

驱动三个东西：
- `wolf profile fields` 命令（人/AI 看说明书）
- `wolf profile fields --required` 列必填
- `wolf doctor` 知道哪些字段非空才算 ready

为什么硬编码 TS 而不从模板注释里 parse 出来？硬编码是 source of truth，可 grep 可跳转可类型检查；从注释 parse 容易语法漂移。一致性靠测试 pin（template 字段路径 == PROFILE_FIELDS 路径）。

### 3️⃣ `storyFields.ts` —— 17 条预设题的清单

```ts
export const WOLF_BUILTIN_STORIES = [
  { id: 'tell_me_about_yourself',  prompt: 'Tell me about yourself',           required: true },
  { id: 'tell_me_about_failure',   prompt: 'Tell me about a time you failed',  required: true },
  // ... 17 条
];
```

stories 单独一个文件因为它形状不同：profileFields 是 dot-path 元数据（`identity.email`），stories 是数组成员 + 每条带 prompt 文字 + required 标记。强行混在一起难看。

驱动什么：
- `wolf init` 时 17 条都 seed 进 profile.toml
- `injectMissingBuiltinStories`（lazy inject）：wolf 升级到第 18 条时，老 profile.toml 缺的会自动补上
- `wolf doctor` 检查"所有 required=true 的 builtin stories 都填了 star_story 没"
- v1→v2 migration 用 prompt 文字反查 builtin id（旧 standard_questions.md 的 `## Tell me about a time you failed` → `story.tell_me_about_failure.star_story`）

### 4️⃣ `profileToml.ts` —— 解析器 + 工具函数

把"磁盘上的 TOML 文件"变成"TypeScript 对象"的桥梁。

```ts
// zod schema 定义形状
export const ProfileTomlSchema = z.object({
  schemaVersion: z.number().int().positive(),
  identity: IdentitySchema,
  contact: ContactSchema,
  // ... 21 个 table
  experience: z.array(ExperienceEntrySchema).default([]),
  story: z.array(StoryEntrySchema).default([]),
});

export type ProfileToml = z.infer<typeof ProfileTomlSchema>;

// 主要 API
export function parseProfileToml(text: string): ProfileToml {
  const obj = parseTomlText(text);          // smol-toml
  const parsed = ProfileTomlSchema.parse(obj);  // zod 校验
  return injectMissingBuiltinStories(parsed);   // lazy inject
}

// 工具函数
export function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

export function getByPath(profile: ProfileToml, dotPath: string) {
  // 'contact.email' → profile.contact.email
  // 'experience.amazon-2024.bullets' → profile.experience.find(...)?.bullets
}
```

**核心约定**：每个文本字段类型是 `z.string().default('')`。意思是：

- 文件里写 `email = """gerry@x.com"""` → 解析得 `'gerry@x.com'`
- 文件里写 `email = """\n\n"""`（空白）→ 解析得 `'\n'`，`isFilled` 返回 false
- 文件里完全不写 `email` 字段 → zod 用 default `''`，仍合法

这让 wolf 端代码统一用 `isFilled(profile.contact.email)` 判"用户填了没"，不需要管文件实际是空字符串、空白、还是字段缺失。

### 测试 pin 住啥（20 条）

1. bundled 模板能 parse 通过——template 里所有字段路径在 schema 里都有定义
2. 17 个 builtin stories 都被 seed 进模板——并且 required 标记跟 storyFields.ts 对得上
3. lazy inject 行为——空 stories 数组被补满；已有的 builtin star_story 不被覆盖；用户自定义 stories 保留
4. isFilled 边界——空字符串 / 全空白 / 全换行 / 各种空白都算 not-filled；任何非空字符算 filled
5. getByPath 各种情况——top-level / array-by-id / 不存在 / boolean / 太多 dots
6. PROFILE_FIELDS 跟模板对齐——双向：template 里的字段路径必须在 PROFILE_FIELDS；PROFILE_FIELDS 的路径必须在 template

## 其他 commit 简略解释（layer 3，BFS 第二轮）

### β.4 + β.5 —— 让 wolf 实际开始用 profile.toml

**β.4 (读路径)**：
- `FileProfileRepositoryImpl` 加了 `getProfileToml(name)` 方法直接返回结构化对象
- 老方法 `getProfileMd / getResumePool / getStandardQuestions` 改成"读 profile.toml + 用 `profileTomlRender.ts` 渲染回 markdown"
- 这样 tailor / cover-letter 这些**还用 markdown 输入**的下游不用改代码——它们以为还在拿 .md，实际已经从 .toml 渲染来
- `init` 不再写 3 个 .md，只写 profile.toml

**β.5 (写命令)**：
- 加了 `wolf profile show / get / set / add / remove / fields` 6 个子命令
- 每个走 `ProfileApplicationService` 里对应方法
- `set` 用 β.2 的 surgical edit 改文件（保注释）
- `add` 生成新 `[[experience]] / [[project]] / [[education]]` 块，id 用 slugify 或 UUID
- `remove` 拒绝删 builtin stories（让用户清空 star_story 替代）

### β.6 —— Doctor 升级

之前 doctor 是这样：
```
读 profile.md → stripComments() → extractH2Content('Email') → 看是否空
```

现在：
```
读 profile.toml (parsed object) → 遍历 PROFILE_FIELDS 中 required 的 → isFilled(getByPath(toml, path))
```

- 用 PROFILE_FIELDS 做 source of truth → `wolf doctor` 和 `wolf profile fields --required` 永远一致
- 报错时直接告诉用户字段的 dot-path（`contact.email`）+ help text，AI 看 doctor 输出就知道下一步跑啥命令
- 同样改造 `assertReadyForTailor`（tailor 跑前的预检查）

### β.7 —— jd.md → SQLite 列

之前 wolf add 把 JD 文本写到 `data/jobs/<dir>/jd.md`。现在写到 `jobs.description_md` 列：

```sql
ALTER TABLE jobs ADD COLUMN description_md TEXT NOT NULL DEFAULT '';
```

- 加个 ALTER TABLE 在 initializeSchema 里，幂等（重复跑不报错）
- `JobRepository.readJdText` 改成 SELECT description_md
- `JobRepository.writeJdText` 改成 UPDATE description_md
- migration v1→v2 里：扫所有 `data/jobs/<dir>/`，读 jd.md，备份到 `.wolf/backups/v1/jobs/<jobId>.jd.md`，写到 SQL 列，删原文件

### β.8 —— wolf context 命令

新命令 `wolf context --for=<scenario>`，给 AI agent 喂上下文。

- `--for=search`：搜岗 agent 用。**只输出**：job_preferences + clearance + experience snapshot + 用户 notes 聚合。**不输出**：identity / contact / address / demographics / stories（搜岗不需要）。前面带"How to use this"指令
- `--for=tailor`：tailor wrapper agent 用。完整 profile + 完整 resume + 填了的 stories
- 输出 deterministic（同 profile.toml 输入 → 同字节输出）→ AI 客户端可以缓存

### β.9 —— workspace-claude.md 重写

每个 wolf workspace 的 `CLAUDE.md` / `AGENTS.md` 是 init 时写的"AI 操作手册"。v1 的版本通篇讲三个 .md 怎么编、用 grep 检查 callout 之类。重写成 v2：

- "用 `wolf doctor` 检查"取代"用 grep 检查"
- "用 `wolf profile set` 写"取代"编 .md 文件"
- 新加"三态规则"节（用户回答 / 跳过 / 显式拒答 三种语义）
- 新加"v1→v2 migration"指引
- profile commands 全表
- context command 介绍 + "搜岗前先 wolf context --for=search"指令

## 文件之间的依赖

```
α (runner 框架)
   │
   └─→ β.3 (v1→v2 migration) 用 runner 注册
              │
              └─→ 用 β.2 (surgical edit) 改 toml
              └─→ 用 β.1 (schema/parser) 验证写出的 toml 合法
              
β.1 (schema + parser)
   ├─→ β.4 ProfileRepository 用它来 parse profile.toml
   ├─→ β.5 wolf profile commands 用它的 getByPath / isFilled
   ├─→ β.6 doctor 用 PROFILE_FIELDS + getProfileToml
   └─→ β.8 wolf context 用 ProfileToml 渲染 markdown 切片
   
β.2 (surgical edit)
   └─→ β.5 wolf profile set 用它

β.7 (jd.md → SQLite) 独立分支，跟 profile 改造没耦合
β.9 (workspace-claude.md) 文档，更新所有上述命令的使用说明
```

**β.1 是承重梁** —— 后面几乎每个 commit 都在用它定义的类型 + 函数。

## 当前状态

- Branch: `feat/migration-runner-framework`
- 12 个 commit（α + β.1-β.10c），未 push
- 测试 326/326 通过
- Build: stable + dev 都干净

### β.10 系列后续

- **β.10a** 合并 `storyFields.ts` 进 `profileFields.ts`。
- **β.10b** `wolf profile add story --prompt --answer` 解锁用户加自定义题。
- **β.10c** v1→v2 migration body 整段 stub 化（pre-1.0 + 零用户；runner 框架保留，body 是 no-op）。
- **β.10d** **PROFILE_FIELDS 升级为模板的单一真相。** bundled `profile.toml`
  从手写 700 行变成 `profileTomlGenerate.ts` 运行时生成的字符串。`FieldMeta`
  上的 `comment` + `defaultValue` 驱动渲染；静态模板文件删除。
- **β.10e** **renderer + search-context loop 化。** `FieldMeta` 加
  `heading` / `section` / `inSearchContext`。`profileTomlRender.ts` 三个函数
  + search-context 渲染都改成基于 PROFILE_FIELDS 的 loop，替换约 70 行手写
  `pushFieldIfFilled`。
- **β.10f** **伪 enum 字符串塌缩。** 5 个 `relocation_*` + 6 个 `sponsorship_*`
  + 4 个 `clearance.*` → 3 个 freeform 字段。`renderRelocationCombined` /
  `renderSponsorshipCombined` 辅助函数删除。Audit 结论：结构化字段无任何
  程序消费方。
- **β.10g** **`[form_answers]` + `[[story]]` 合并成 `[[question]]`。**
  6 个 form_answers 升级为 `WOLF_BUILTIN_QUESTIONS` 的 builtin 条目（现 23 条
  = 6 短答 + 17 STAR）。字段 `star_story` → `answer`。
  `BuiltinQuestion.defaultAnswer?` 携带预填默认值。CLI：`wolf profile add story`
  → `add question`。`parseProfileToml` 检测到旧 `[[story]]` 时抛错，避免静默
  数据丢失。
- **β.10h** **Job 制品路径 → 约定 + 布尔。** 5 个可空字符串列删除 → 4 个布尔。
  新增 `JobRepository.getArtifactPath(id, kind)` 按约定解出路径。
  `hasX = true` 表示"wolf 产出过此制品"，不保证文件还在磁盘上。
- **β.10i** **Skills 5→1 + 内联 note。** `skills.*` 5 子字段 → `skills.text`。
  每个 `<table>.note` 在所属 H1 块末尾内联渲染；独立的 `## User notes` 提取块
  删除。
- **β.10j** **Salary 拆 low/high + 动态 salary_expectation。**
  `Job.salary` → `salaryLow` + `salaryHigh`。`salary_expectation` 静态默认
  删除，由 fill 在运行时根据 JD 区间计算。
- **β.10k** **unpaid sentinel 移除。** `Salary` → `number`。约定：`0` = 显式
  无薪、`null` = 未知。`low=0 + high=N` 合法。Reviewer 标记的命名残留一并清扫
  （`addStory` → `addQuestion`、`buildStoryBlock` → `buildQuestionBlock`、
  `checkStoriesAndFormAnswers` → `checkQuestions`、`# Stories` H1 → `# Q&A`）。

### `wolf job` CLI 表面（与 β.10h 同步加入）

- `wolf job show <id>` —— 全行 + JD 文本 + 公司名
- `wolf job get <id> <field>` —— pipe 友好读
- `wolf job set <id> <field> <value>` —— 走 `JobRepository.update` 单列 patch；按 `JOB_FIELDS` 强制类型
- `wolf job fields [name]` —— schema 参考；`--required` / `--json`

`JOB_FIELDS` 镜像 `PROFILE_FIELDS` 的单一真相：18 个可编辑字段，含
`enum` / `boolean` / `number` / `nullableEnum` 类型 + 明确 help。系统管理字段
（`id` / `companyId` / `createdAt` / `updatedAt`）`set` 拒绝。

### 字段级 audit

`docs/dev/FIELDS_AUDIT.md` 快照了 β.10k 时所有 wolf 定义字段。涵盖 profile 平表、
profile 数组（experience / project / education / question）、23 个 builtin
question 含默认答案、18 个 Job 可编辑列、§5 review status 跟踪每条 audit 的解决。

## 还没做（β.10 + 余项）

- 新的 profile / job CLI 表面在 acceptance test 组里没覆盖（仅 smoke 有 init + list）
- 多 profile 端到端测试
- Reviewer 标记 β.10k 留待后续：
  - 负数薪资接受 —— 可加 `n >= 0` guard
  - low > high 反向区间检测 —— 暂时只 doc 提及
  - `salary_expectation` 运行时计算契约 → DECISIONS.md（M4 fill prompt 落地时再 pin）
