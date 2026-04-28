# Wolf Profile Fixtures

## 用途

为 acceptance 测试预置的 `profile.md` + `resume_pool.md` 组合,放进
`WOLF_DEV_HOME/profiles/default/` 当候选人身份。每个 fixture 是一个 persona ——
一份真实可信的候选人材料,AI agent 可以基于它写出 tailored resume / cover letter。

这些 fixture **仅服务于 acceptance 测试基础设施**,不被 `wolf init` 使用,
也不展示给最终用户。

## 为什么用 fixture

每个 TAILOR-XX 用例 inline 50+ 行的 profile + resume 重复严重,模板演化时
还会漂移。集中放在这里之后:

- AC 文档保持精简(`cp -r test/fixtures/wolf-profile/ng-swe/* "$WS/profiles/default/"`)
- 增加覆盖只要加一个 fixture,不必再写一份 inline heredoc

## 目录结构

```
test/fixtures/wolf-profile/
├── README.md
├── README_zh.md                   ← 本文件
├── swe-mid/                       ← 中级后端 SWE persona(Java/Scala/Spark/Kafka)
│   ├── profile.md
│   └── resume_pool.md
└── ng-swe/                        ← NG 全栈 SWE persona(TS/Go/Python;F-1 OPT)
    ├── profile.md
    └── resume_pool.md
```

每个 fixture 的 `profile.md` 都满足 `assertReadyForTailor` 的必填字段
(Legal first name / Legal last name / Email / Phone),代表一份完整一致的
候选人身份。`resume_pool.md` 远超过 5 行 substantive 内容的阈值。

## 在测试里如何用

Acceptance 测试 setup 把 fixture 拷进 workspace 的默认 profile 目录:

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/<test-id>
WOLF_DEV_HOME="$WS" npm run wolf -- init --dev --empty
cp -r test/fixtures/wolf-profile/ng-swe/* "$WS/profiles/default/"
```

(`cp -r` 从 repo 根执行,因为 test runner 的 cwd 就是 wolf 根目录。)

拷完后 `wolf tailor full --job <id>` 拿到一份完整 profile + 实在的 resume_pool,
产出会是有内容的。

## 选哪个 fixture

| Fixture | 何时用 | 当前被谁用 |
|---|---|---|
| `ng-swe` | wolf 的主用户画像 —— NG 海投场景;F-1 + H-1B sponsor 偏好已配置;intern 级别经历,pool 偏轻。新建 AC case 默认选这个。 | `TAILOR-01`(full pipeline)|
| `swe-mid` | 中级多 role 后端候选人(Spark / Kafka / Java)。case 本身需要资深 pool 体量时用,例如 section-honesty 之类需要在密集多 role pool 上验证排序的结构性 case。 | `TAILOR-04`(section honesty —— 仅用 profile.md;sub-case 自带 inline pool 覆盖)|

> Fixture 覆盖现在故意保持窄:每个 persona 只一条标准 fixture 驱动的 AC case。其他地方同理 —— 更多 persona × 场景组合留到 prompt 调试阶段(prompt 真正可靠之后)再说,那时候 persona 特异的质量回归才有意义,不必现在在 AC inline 里扩 persona 矩阵。

新增 persona:创建同级目录 + `profile.md` + `resume_pool.md`,更新这张表。

## 约束

- Fixture 里都是**虚构人物**。不要用真实可解析到真人的姓名 / 邮箱 / 电话 / 学校 / 公司
- 邮箱用 `.test` TLD(RFC 6761),发不出去
- 电话用 555 区号(虚构号段)
- Fixture 保留 wolf marker 约定:`> [!IMPORTANT]` / `> [!TIP]` 是 AI 不可见的注释
  块。strip 完之后剩下的必须是一份语义完整的 profile / pool

## 维护

模板形状变(加 H1 / 删 H2 等)时,同步更新 fixture 让 AC 还能 drop-in。表格保持同步。
