# 贡献指南 — wolf

欢迎！这份指南会带你了解参与 wolf 开发所需的一切。不假设你有 TypeScript 项目的经验——每一步都会给出具体命令。

---

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/guanyu-gerry-tao/wolf.git
cd wolf

# 2. 安装依赖
npm install

# 3. 编译项目
npm run build

# 4. 开发模式运行（修改代码后自动重新编译）
npm run dev

# 5. 运行测试
npm run test
```

> **注意：** 如果 `npm install` 失败，请确保已安装 **Node.js 18+**。运行 `node -v` 查看版本。

---

## 分支与 PR 流程

所有改动都通过 Pull Request 提交。**永远不要直接推送到 `main` 分支。**

### 分支命名

格式：`<type>/<short-name>`

| 前缀 | 使用场景 | 示例 |
|---|---|---|
| `feat/` | 新功能 | `feat/hunt-scoring` |
| `fix/` | 修复 bug | `fix/config-crash` |
| `docs/` | 仅文档改动 | `docs/add-api-reference` |
| `refactor/` | 代码重构，不改变行为 | `refactor/extract-provider` |
| `test/` | 添加或修复测试 | `test/hunt-unit-tests` |
| `chore/` | 工具链、CI、依赖 | `chore/add-eslint` |

### 创建分支和 PR

```bash
# 创建新分支
git checkout -b feat/my-feature

# 做出改动后，暂存并提交
git add src/commands/hunt.ts
git commit -m "feat: add job deduplication logic"

# 推送到远程
git push -u origin feat/my-feature

# 在 GitHub 上创建 PR（也可以用 GitHub 网页界面）
gh pr create --title "feat: add job deduplication" --body "Closes #12"
```

### PR Review 规则

| PR 发起人 | 谁来审批 |
|---|---|
| 项目 owner | 自己审批即可 |
| 其他 collaborator | 需要项目 owner 审批 |
| Fork 贡献者 | 需要项目 owner 审批 |

---

## 提交规范

格式：`<type>: <简短描述>`

```
feat: add LinkedIn scraper integration
fix: handle missing email field in config
docs: add TYPES.md with shared type definitions
refactor: extract provider interface from hunt command
test: add unit tests for job scoring
chore: configure ESLint and Prettier
```

**注意事项：**
- 用英文写
- 保持简洁——描述**为什么**，而不是**做了什么**
- 冒号后面小写开头
- 结尾不加句号

---

## 代码规范

### 项目结构规则

wolf 使用**分层架构**。完整说明请看 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。核心规则：

```
src/cli/       → 薄包装层。解析参数，调用命令，格式化输出。
src/mcp/       → 薄包装层。定义 tool schema，调用命令，返回 JSON。
src/commands/  → 所有业务逻辑都在这里。不要从 cli/ 或 mcp/ 导入。
src/types/     → 共享的 TypeScript 类型。各层之间的契约。
src/utils/     → 共享工具函数（配置、数据库、日志）。
```

**应该做的：**
- 业务逻辑放在 `src/commands/`
- 使用 `src/types/` 中定义的类型——不要随意定义临时类型
- 命令函数返回结构化数据——永远不要在命令内部直接 `console.log`

**不应该做的：**
- 在 `src/cli/` 或 `src/mcp/` 中放 API 调用或业务逻辑
- 命令之间互相导入——命令之间通过 SQLite 通信

### TypeScript

- 开启严格模式（`tsconfig.json` 中 `strict: true`）
- 函数参数和返回值使用显式类型标注
- 对象结构优先用 `interface`，不用 `type`

### 代码检查与格式化

> **状态：** ESLint 和 Prettier 将在 Milestone 1 完成时配置。目前请参照现有代码的风格。

配置好后运行：

```bash
npm run lint        # 检查问题
npm run lint:fix    # 自动修复
npm run format      # 用 Prettier 格式化
```

---

## 文档规范

**每份 markdown 文档**（除 `CLAUDE.md` 和 `README.md` 外）**都必须有 `_zh` 后缀的中文版本**。

| 英文 | 中文 |
|---|---|
| `docs/ARCHITECTURE.md` | `docs/ARCHITECTURE_zh.md` |
| `CONTRIBUTING.md` | `CONTRIBUTING_zh.md` |

**两个版本必须在同一个 commit 中创建或更新。** 如果你改了英文版，也要同步更新中文版。

完整的文档结构说明见 [docs/PROJECT-DOCUMENTATION-STRUCTURE.md](docs/PROJECT-DOCUMENTATION-STRUCTURE.md)。

---

## 测试

### 测试框架

我们使用 **vitest** —— 一个快速的、TypeScript 原生的测试运行器。

```bash
npm run test             # 运行所有测试
npm run test -- --watch  # 文件变更时自动重新运行
```

### 测试驱动开发（Test-Driven Development, TDD）

**先写测试，再写代码。** 这不是可选的。

1. 先写一个描述期望行为的失败测试
2. 写最少的代码让测试通过
3. 需要的话再重构——测试保护你

示例：

```typescript
// 先写这个：
it('should reject scores outside 0.0-1.0', async () => {
  mockClaude.returns({ score: 1.5 });
  await expect(hunt(options)).rejects.toThrow('Score out of range');
});

// 然后再在 hunt.ts 里实现验证逻辑
```

### AI 功能测试

任何调用 Claude API 的命令都**必须** mock API 并验证返回值的结构。这能防止 AI 幻觉搞坏东西。详情见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 用 AI 写代码（Vibe Coding）

使用 AI 工具写代码是**允许且鼓励的**。Claude Code、Cursor、ChatGPT——用什么顺手就用什么。

**一条规矩：** 在提交 AI 生成的代码之前，你**必须**让 AI 解释一下这段代码做了什么，确保你自己理解了。虽然有测试保护，但不要盲目提交 AI 产出——它可能会引入表面上能通过测试但实际上是垃圾的代码。

---

## 怎么找活干

不知道做什么？这样找任务：

1. **看里程碑清单** — 打开 [docs/MILESTONES.md](docs/MILESTONES.md)，找未勾选的项目（`- [ ]`）
2. **浏览 GitHub Issues** — 筛选 `good first issue` 或 `help wanted` 标签，找已准备好的任务
3. **认领任务** — 在 issue 下留言（"I'd like to work on this"）或直接联系项目 owner，owner 会把 issue assign 给你，避免重复开发
4. **被 assign 后再开始** — 防止两个人做同一件事

---

## 遇到问题怎么办

卡住的时候：

1. **先问你的 AI**（强烈推荐）— 把报错信息贴到 Claude Code、ChatGPT 或者你用的任何 AI 工具里。大部分开发问题都能这样解决。
2. **CI/CD 跑不过不知道怎么修？** — 复制错误输出，让 AI 帮你分析原因和解决方案。
3. **还是搞不定？** — 联系项目 owner。

---

## 关键文档

| 文档 | 内容 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | 项目概览、技术栈、常用命令 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统设计、各层职责 |
| [docs/TYPES.md](docs/TYPES.md) | 所有共享的 TypeScript 类型 |
| [docs/MILESTONES.md](docs/MILESTONES.md) | 路线图和任务清单 |
| [docs/SCOPE.md](docs/SCOPE.md) | wolf 做什么和不做什么 |
