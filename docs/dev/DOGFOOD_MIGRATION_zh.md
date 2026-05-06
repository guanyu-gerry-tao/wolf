# Dogfood 迁移：dev → stable

如何把 dev workspace（`~/wolf-dev`，本地 build 的 `wolf-dev` binary 写入的）
里的数据搬到全新的 stable workspace（`~/wolf`，`npm i -g @gerryt/wolf`
装的稳定版写入的）。

适用场景：**首发 stable 之前**，wolf 还没上 npm，你要先在 dev 上 dogfood
几天，再用 stable binary 验证一遍才敢 publish。

## 为什么要迁移

dev 和 stable **故意分开 workspace**，避免重构搞坏真实数据：

| 维度 | dev | stable |
|---|---|---|
| Workspace dir | `~/wolf-dev`（`WOLF_DEV_HOME`） | `~/wolf`（`WOLF_HOME`） |
| Bin | `wolf-dev` | `wolf` |
| Env 前缀 | `WOLF_DEV_*`（fallback 到 `WOLF_*`） | `WOLF_*` |
| MCP 工具前缀 | `wolfdev_*` | `wolf_*` |
| Workspace 里的 `CLAUDE.md` / `AGENTS.md` | 写的是 `wolf-dev` 命令 | 写的是 `wolf` 命令 |

SQLite schema、profile 文件结构、per-job 产物布局都一样 —— 只有外围身份不同。
所以迁移本质就是**文件拷贝 + 几处身份字符串修正**。

## Workspace 里到底有什么

```
~/wolf-dev/
├── wolf.toml                     ← 配置（model 选择、默认 profile 名）
├── CLAUDE.md / AGENTS.md         ← AI agent 指引（绑定 binary 名）
├── profiles/<name>/
│   ├── profile.md                ← 你的身份信息
│   ├── resume_pool.md            ← 你的简历池
│   ├── standard_questions.md     ← 申请专用 Q&A
│   └── attachments/              ← 成绩单、推荐信等
└── data/
    ├── wolf.sqlite               ← 职位 DB
    ├── logs/wolf.log.jsonl       ← 日志文件（不迁，stable 重新开始）
    └── jobs/<jobId>/             ← 每条 job 的产物（resume.pdf、cover_letter.pdf、brief.md 等）
```

| 类别 | 迁移？ |
|---|---|
| Profile 文件（`profile.md`、`resume_pool.md`、`standard_questions.md`、`attachments/`） | **要** — 你的真内容 |
| 职位 DB（`data/wolf.sqlite`） | **要**（如果 dev 时加过 job） |
| Job 产物（`data/jobs/<jobId>/`） | **要**（如果 dev 时跑过 tailor） |
| `wolf.toml` | **跳过** — 让 stable 重新生成；避免 `instance.mode = "dev"` 残留 |
| `CLAUDE.md` / `AGENTS.md` | **跳过** — 让 stable 重新生成；里面的 binary 引用不一样 |
| `data/logs/wolf.log.jsonl` | **跳过** — 运行时状态，新开始更干净 |

## 方案 A — Cherry-pick（推荐）

让 stable 的 `wolf init` 产生干净的 `wolf.toml` + `CLAUDE.md` /
`AGENTS.md`，然后把 dev 的内容覆盖上去。

```bash
# 0. 前置条件:
#    - @gerryt/wolf 已装:                npm i -g @gerryt/wolf
#    - WOLF_ANTHROPIC_API_KEY 已设:      wolf env set
#    - ~/wolf 还不存在（如果存在先备份）

# 1. Stable workspace 骨架 — 产生 wolf.toml + 空 profiles/default/
#    + CLAUDE.md/AGENTS.md（里面是 `wolf <verb>` 引用）
wolf init --preset empty

# 2. 拷三个 profile markdown
cp ~/wolf-dev/profiles/default/profile.md            ~/wolf/profiles/default/
cp ~/wolf-dev/profiles/default/resume_pool.md        ~/wolf/profiles/default/
cp ~/wolf-dev/profiles/default/standard_questions.md ~/wolf/profiles/default/

# 3. 拷附件（如果有）
cp -r ~/wolf-dev/profiles/default/attachments/. \
      ~/wolf/profiles/default/attachments/ 2>/dev/null

# 4. 拷职位 DB（dev 没加 job 就跳）
cp ~/wolf-dev/data/wolf.sqlite ~/wolf/data/ 2>/dev/null

# 5. 拷 per-job 产物（dev 没跑 tailor 就跳）
cp -r ~/wolf-dev/data/jobs/. ~/wolf/data/jobs/ 2>/dev/null

# 6. 验证
wolf doctor                  # profile + key + Chromium 全过
wolf job list                # 看到 dev 时加的 job
```

**为什么不直接 `cp -r ~/wolf-dev/ ~/wolf/`？** 那会把 dev build 的
`wolf.toml`（如果你跑的是 `wolf-dev init --preset empty`，里面有
`instance.mode = "dev"`）和 dev 风味的 `CLAUDE.md` / `AGENTS.md`（AI
agent 看到 `wolf-dev <verb>` 会让你跑一个 stable 上不存在的 binary）一起带过去。Cherry-pick 避免两者。

## 方案 B — 整体拷贝 + 清理（更快，略有风险）

附件多 / job 多想一次拷的话用这条。

```bash
# 0. 前置条件: 同方案 A
mkdir -p ~/wolf

# 1. 整体拷贝
cp -r ~/wolf-dev/. ~/wolf/

# 2. 去掉 wolf.toml 里的 dev 标记
sed -i.bak '/^mode = "dev"/d' ~/wolf/wolf.toml
rm ~/wolf/wolf.toml.bak

# 3. 重新生成 AI agent 文档（用 stable 模板）
rm ~/wolf/CLAUDE.md ~/wolf/AGENTS.md
wolf init --preset empty       # writeIfAbsent 填这两个文件；其他已存在的不动

# 4. 删掉 dev 的日志（stable 重新开始）
rm -f ~/wolf/data/logs/wolf.log.jsonl

# 5. 验证
wolf doctor
wolf job list
```

## 验证清单

两条路任意一条之后：

- [ ] `wolf doctor` 报告 READY（或者只有跟 dev 上一样的 gap）
- [ ] `wolf job list` 显示 dev 时加的 job
- [ ] 打开 `~/wolf/CLAUDE.md` —— 代码块里的命令都是 `wolf`（不是 `wolf-dev`）
- [ ] `head -1 ~/wolf/wolf.toml` 不包含 `mode = "dev"`
- [ ] 用现有 jobId 跑 `wolf tailor full -j <jobId>` 产生新 `resume.pdf`（验证 SQLite 拷贝 + Chromium 自动安装都对）

## Env vars 怎么处理？

你 dev 时 shell RC 里可能有 `WOLF_DEV_ANTHROPIC_API_KEY`。Stable 只读
`WOLF_ANTHROPIC_API_KEY`（不会 fallback 到 dev 前缀）。两个选择：

- **推荐**：装完 stable 后跑一次 `wolf env set`，把
  `WOLF_ANTHROPIC_API_KEY`（用同一个 key）写进 shell RC。重启 terminal。
- **手动**：编辑 `~/.zshrc`（或对应文件），把 `WOLF_DEV_ANTHROPIC_API_KEY=...`
  行旁边加一行 `WOLF_ANTHROPIC_API_KEY=...`。两个共存：dev 仍读
  `WOLF_DEV_*`，stable 读 `WOLF_*`。

## 迁移之后 dev workspace 怎么办

`~/wolf-dev` 不会被迁移动。继续作为你 wolf 开发的 sandbox。两个 binary
（`wolf` 和 `wolf-dev`）在 PATH 上共存，操作各自独立的 workspace。

想把 dev 也清干净的话：
```bash
rm -rf ~/wolf-dev
wolf-dev init --preset empty
```

## 这个文档什么时候不再需要

`@gerryt/wolf` 上 npm 之后，朋友和你都直接 dogfood stable。这条 dev →
stable 的迁移路径只是**你自己**首发前的 bootstrap —— 第一次 publish 时
你想用真数据验证 stable，又不想从头敲一遍 profile。

等到 stable workspace migration 框架落地（按根 `CLAUDE.md` § Workspace
migrations 的契约），这份指南会被自动迁移机制替代。
