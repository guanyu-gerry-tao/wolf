# Wolf Profile Fixtures

## 用途

为 acceptance 测试预置的 persona fixture。测试通过公开的 `wolf profile`
CLI 把它们写进 `WOLF_DEV_HOME/profiles/default/profile.toml`。每个 fixture 是
一个 persona —— 一份真实可信的候选人材料,AI agent 可以基于它写出 tailored
resume / cover letter。

这些 fixture **仅服务于 acceptance 测试基础设施**,不被 `wolf init` 使用,
也不展示给最终用户。

## 为什么用 fixture

每个 TAILOR-XX 用例 inline 50+ 行的 profile + resume 重复严重,模板演化时
还会漂移。集中放在这里之后,AC 文档保持精简,并且 setup 跟当前
`profile.toml` 数据治理表面对齐,不再复制旧的 markdown 文件。

## 目录结构

```
test/fixtures/wolf-profile/
├── README.md
├── README_zh.md                   ← 本文件
├── scripts/
│   └── populate_v2_profile.sh      ← 通过 CLI 填充 profile.toml 的 fixture loader
├── swe-mid/                       ← 中级后端 SWE persona(Java/Scala/Spark/Kafka)
│   ├── profile.md
│   └── resume_pool.md
└── ng-swe/                        ← NG 全栈 SWE persona(TS/Go/Python;F-1 OPT)
    ├── profile.md
    └── resume_pool.md
```

这些 markdown 文件是 persona 的可读来源 / 参考材料。真正可运行的 acceptance
setup 使用 `scripts/populate_v2_profile.sh`,它通过 `wolf profile set` 和
`wolf profile add` 把同一份 persona 形状写入 `profile.toml`。

## 在测试里如何用

Acceptance 测试 setup 初始化 workspace 后,通过 CLI 填充默认 profile:

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/<test-id>
WOLF_DEV_HOME="$WS" npm run wolf -- init --preset empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
```

脚本从 repo 根执行,因为 test runner 的 cwd 就是 wolf 根目录。脚本不调用 AI。
API-backed case 仍应在 setup 后跑 `wolf doctor`,让缺 API key 或 Playwright
Chromium 的问题在昂贵命令前失败。

脚本跑完后,`wolf tailor full --job <id>` 会看到完整 profile、resume pool 和
builtin question answers,产出会是有内容的。

## 选哪个 fixture

| Fixture | 何时用 | 当前被谁用 |
|---|---|---|
| `ng-swe` | wolf 的主用户画像 —— NG 海投场景;F-1 + H-1B sponsor 偏好已配置;intern 级别经历,pool 偏轻。新建 AC case 默认选这个。 | `TAILOR-01`(full pipeline)|
| `swe-mid` | 中级多 role 后端候选人(Spark / Kafka / Java)。case 本身需要资深 pool 体量时用。 | `TAILOR-04` 的参考 persona |
| `swe-mid-no-education` | 同一个中级后端 persona,但不添加 education entry,并把 `resume.section_order` 设为 Experience -> Project -> Skills。 | `TAILOR-04a` |
| `swe-mid-reordered` | 同一个中级后端 persona,并把 `resume.section_order` 设为 Skills -> Project -> Experience -> Education。 | `TAILOR-04b` |

> Fixture 覆盖现在故意保持窄:每个 persona 只一条标准 fixture 驱动的 AC case。其他地方同理 —— 更多 persona × 场景组合留到 prompt 调试阶段(prompt 真正可靠之后)再说,那时候 persona 特异的质量回归才有意义,不必现在在 AC inline 里扩 persona 矩阵。

新增可运行 persona:扩展 `scripts/populate_v2_profile.sh`,并更新这张表。如果需要
人类可读的来源 fixture,也可以继续新增同级 markdown 目录。

## 约束

- Fixture 里都是**虚构人物**。不要用真实可解析到真人的姓名 / 邮箱 / 电话 / 学校 / 公司
- 邮箱用 `.test` TLD(RFC 6761),发不出去
- 电话用 555 区号(虚构号段)
- Markdown 参考 fixture 保留 wolf marker 约定:`> [!IMPORTANT]` / `> [!TIP]`
  是 AI 不可见的注释块。strip 完之后剩下的必须是一份语义完整的 profile / pool。

## 维护

模板形状变(新增 required field、array 重命名、section 删除等)时,同步更新
`populate_v2_profile.sh`,让 AC 仍能生成有效的 `profile.toml`。表格保持同步。
