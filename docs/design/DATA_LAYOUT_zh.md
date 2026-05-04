# 数据布局

wolf 决定"什么数据放 SQLite、什么数据放磁盘文件"的依据。

## 原则

> **schema = repository 能直接 CRUD 的值。
> disk    = 外部原文、渲染产物、用户手写内容。**

判据来自**写入路径**,而不是内容性质。"是事实还是判断?"、"是长还是短?"、"是结构化还是自由文本?" 都不是正确的问题。正确的问题是:

**"这条数据由谁、以什么方式写入?"**

- 由 wolf 代码经 repository 写入 → schema。
- 来自外部原文、渲染产物、或人手写的笔记 → disk。

## 三类划分

### 1. Schema — 键、维度、程序写入的值

满足以下**任一**条件时进 SQLite 列:

- 主键、外键,或指向其他实体的指针
- repository 查询用的过滤 / 排序 / 分组维度
- 取值范围已知且无歧义的枚举或数值
- 由 wolf 程序化产出并更新的短值(文本 / JSON / 标签)

当前 schema 中的例子:

- `jobs.id`、`jobs.company_id`、`jobs.url` — 键 / 指针
- `jobs.status`、`jobs.source` — 枚举,被 `wolf job list` 过滤
- `jobs.score`、`jobs.score_justification` — score 流水线写入的值
- `jobs.error` — 短失败标签,由 repo 在失败时写入
- `batches.batch_id`、`batches.status` — provider ID 与执行状态

### 2. Disk — 原文、渲染产物、用户手稿

满足以下**任一**条件时存到 workspace 下的文件:

- 外部原文(JD 文本、从招聘页拷贝的公司介绍)
- 渲染产物或下游工具直接消费的大型文档(给 ATS 的 PDF 简历、给邮件附件用的 HTML/PDF cover letter、截图)
- 人手写的内容(profile 的三 MD、用户敲进去的备忘)
- **位置由约定固定**的程序生成文件,数据库不必再记录它在哪里

例子:

- `data/jobs/<slug>/jd.md` — JD 原文
- `data/jobs/<slug>/tailored_resume.pdf` — 渲染产物,文件名固定
- `data/jobs/<slug>/cover_letter.{html,pdf}` — 同上
- `<workspace>/profiles/<id>/profile.md`、`resume_pool.md`、`standard_questions.md` — 用户手写

### 3. 约定路径 — 既不进 schema 也不另外建索引

当某文件的路径可由一行记录加 slug 规则确定性推导时,**数据库不存路径**。slug 函数 + 目录约定是唯一来源。

```
slug(job)      = sanitize(company.name) + "_" + sanitize(job.title) + "_" + job.id.slice(0, 8)
artifactPath() = workspaceRoot + "/data/jobs/" + slug(job) + "/<固定文件名>"
```

是否存在用 `fs.existsSync` 直接查文件系统判断,不依赖列。这避免了"DB 说有但文件已删"(或反之)的漂移 bug。

## 反模式

| 反模式 | 为什么错 | 正确做法 |
|---|---|---|
| `tailored_resume_pdf_path TEXT` 等 `*_path` 列 | 路径由 slug + 固定文件名推导。存路径等于把约定抄了一遍,容易 DB/disk 漂移。 | 删掉列,用 `pathFor(job, artifact)` 计算。 |
| 把 AI 产出的 `score_justification` 追加进某个 MD 文件 | 写哪个文件?哪个 section?是 append 还是 replace?写入语义模糊,容易出错。 | 存进 TEXT 列。Repo 写入原子、明确。 |
| 把 JD 原文塞进 `jobs.description TEXT` | 长外部 blob 不属于行,AI 和人都会读它,但绝不会被 SQL 过滤。 | 存为 `data/jobs/<slug>/jd.md`。 |
| 给一个本应是枚举但用户/AI 想表达"看情况"的字段用自由文本 TEXT | "博弈"发生在**读取**时(score / tailor),不在**写入**时。记录的应是 JD 上的事实快照,JD 没写就是 `NULL`。 | 列保持结构化(enum / JSON / `NULL`)。让 AI 读 `jd.md` 解释含糊。 |
| 把可推导的时间戳 / 路径 / 标记字段在多个列里复制 | 同步成本上升。 | 选一个 source of truth(通常是 slug+约定或某个单列),其余推导。 |

## 何时新增 schema 列 vs. 新增文件

依次问:

1. **是否有 repository 需要按这条数据查询、排序、过滤、计数?** → schema 列。
2. **wolf 代码是否会程序化更新它(覆盖、追加标签、改状态)?** → schema 列。
3. **它是外部原文、渲染产物、还是用户手稿?** → disk 文件。
4. **它是程序生成、且位置固定约定的文件?** → disk 文件,不建路径列。

如果 (1) 和 (2) 都是"否",且数据是长 blob 或独立文档,基本就是 disk 的事。

## 本文不覆盖的边界

- **索引、外键、迁移** — 参见 `ARCHITECTURE.md` 与未来的迁移文档。
- **具体 schema** — 以 `src/repository/impl/schema.ts` 为唯一来源。
- **Profile 内部布局** — 参见 `ARCHITECTURE.md` 的 profile 章节。

## 相关文档

- `ARCHITECTURE.md` — 五层架构与 repository 的位置
- `src/repository/impl/initializeSchema.ts` — DDL
- `src/repository/impl/schema.ts` — drizzle 表定义
