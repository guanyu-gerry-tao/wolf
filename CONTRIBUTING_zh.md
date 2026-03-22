# 贡献指南 — wolf

> [!IMPORTANT]
> 在开始之前：把这份文档下载下来，丢给 Claude、ChatGPT 或任何 AI 工具，让它陪你一步步操作。遇到任何报错或不懂的地方，直接问 AI 会快得多 :)

## 什么是开源项目，什么是贡献

开源项目就是代码公开在网上、任何人都可以查看和参与的项目。wolf 就是这样一个项目。

"贡献"就是你帮这个项目写了一些功能，或者修了一个 bug，然后提交给项目 owner 审核。审核通过后，你写的代码就正式成为这个项目的一部分，你的名字也会出现在项目的贡献者列表里。

你不需要被雇佣，这不是工作，不需要签证，也不需要任何人许可，任何人都可以贡献。

**为什么要贡献？**

- **简历加分** — 开源贡献是你可以在 GitHub 和简历上直接展示的公开记录，面试官可以看到你写过什么
- **学真正的工程实践** — 读别人写的代码、在 code review 中被指出问题、在真实项目里解 bug，这些比做练习题学到的多得多
- **建立人脉** — 和项目 owner、其他贡献者一起协作，认识真正在做工程的人
- **用你自己写的工具** — wolf 是一个帮你找工作的工具，你写了它，你也用它

## 你能做什么

wolf 是一个用 AI 帮你找工作的工具，还在开发中。你可以参与实现它的功能。

不需要很强的经验——只要你愿意用 AI 辅助写代码。

如果你掌握一些TypeScript 或 JavaScript 的知识，那就更好了。欢迎成为这个项目的 Collaborator 和 Maintainer ，协助管理项目，审核 PR，规划路线图。

## 第零步：准备你的开发环境

> 在写代码之前，你需要先在电脑上安装几个工具。这一步只需要做一次。如果你不确定自己有没有装过，把下面每条命令输进终端，看看有没有报错。

**1. 安装 Git**

Git 是用来管理代码版本的工具，下载项目、提交代码都要用它。

- Mac：打开终端，输入 `git --version`，如果有版本号说明已安装；没有的话系统会自动提示你安装
- Windows：去 [git-scm.com](https://git-scm.com) 下载安装包

**2. 安装 Node.js（含 npm）**

wolf 是用 JavaScript/TypeScript 写的，运行它需要 Node.js。npm 是 Node.js 自带的包管理器。

去 [nodejs.org](https://nodejs.org) 下载 LTS 版本（推荐 18 或更高版本）。

安装完后，运行以下命令验证：

```bash
node -v   # 应该显示版本号，如 v22.0.0
npm -v    # 应该显示版本号，如 10.0.0
```

**3. 安装代码编辑器**

推荐 [VS Code](https://code.visualstudio.com)，免费且功能强大。装好后可以再装 Claude Code 插件，让 AI 直接在编辑器里帮你写代码。

## 第一步：Fork 项目到你的 GitHub 账号

> 你没有权限直接修改 wolf 的代码库——这是正常的，外部贡献者都是这样。解决办法是"fork"：在 GitHub 上把 wolf 复制一份到你自己的账号下，你就对这份副本有完全的控制权。改好之后，再发申请让 wolf 把你的改动合并进去。

1. 打开 [wolf 的 GitHub 页面](https://github.com/guanyu-gerry-tao/wolf)
2. 点击右上角的 **Fork** 按钮
3. 选择你自己的账号，确认创建

完成后你会拥有 `你的用户名/wolf` 这个仓库，这就是你的个人副本。

## 第二步：把项目下载到你的电脑

> 注意：clone 的是你 fork 后的副本，不是原始的 wolf 仓库。这样你才能把代码推送上去。

先在电脑上准备一个放项目的文件夹：

```bash
# Mac/Linux：
mkdir -p ~/Documents/projects
cd ~/Documents/projects

# Windows：
mkdir C:\Users\你的用户名\Documents\projects
cd C:\Users\你的用户名\Documents\projects
```

然后 clone 你的 fork（把 `你的用户名` 替换成你的 GitHub 用户名）：

```bash
git clone https://github.com/你的用户名/wolf.git
cd wolf
```

最后，把原始仓库也关联进来，方便之后同步更新：

```bash
git remote add upstream https://github.com/guanyu-gerry-tao/wolf.git
```

> [!NOTE]
> `origin` 指向你的 fork，`upstream` 指向原始的 wolf 仓库。以后原始仓库有更新，可以用 `git fetch upstream` 同步过来。

## 第三步：安装依赖，跑起来

> 确认你现在在 `wolf` 文件夹里（终端路径里应该能看到 `wolf`）。项目用到了很多别人写好的工具包（叫"依赖"）。`npm install` 会自动把它们全部下载到你的电脑。这一步只需要做一次。

```bash
npm install   # 安装所有依赖包
npm run build # 把 TypeScript 编译成 JavaScript
```

验证一下是否成功：

```bash
npm test  # 运行测试，应该全部通过
```

如果看到 `X passed`，说明一切正常。

如果有测试失败，先把错误信息完整复制给 AI 问一下。还是搞不定，联系项目 owner。

## 第四步：找一个任务来做

> 开源项目的任务是公开发布的，就像游戏里的悬赏公告板——任何人都可以挑一个来做。做完提交，审核通过后，你写的代码就正式进入项目，这就是"贡献"。

1. 打开 [GitHub Issues](https://github.com/guanyu-gerry-tao/wolf/issues)
2. 找标有 `good first issue` 的任务——这些专门为新手设计
3. 点进去仔细读，里面通常会写清楚：要做什么、从哪个分支开始、怎么验收
4. 在 issue 下面留言："I'd like to work on this"
5. 等项目 owner 把这个 issue assign 给你，然后进入下一步 👇

> [!NOTE]
> 为什么要等 assign？因为可能有两个人同时想做同一个任务，assign 可以避免重复劳动。

## 第五步：创建自己的分支

> "分支"（branch）就是你自己的工作副本，在上面改代码不会影响主代码库。改完之后再提交合并申请。这是团队协作的标准做法。

> [!IMPORTANT]
> issue 里通常会指定你应该从哪个分支开始（叫 base branch），不一定是 `main`。你的分支要从 base branch 创建，PR 最后也要合并回 base branch。

```bash
# 先从 upstream 拉取最新分支（刚 clone 的 fork 只有 main，没有其他分支）
git fetch upstream

# 切到 issue 指定的 base branch（把 <base-branch> 替换成 issue 里写的那个）
git checkout -b <base-branch> upstream/<base-branch>

# 再从这里创建你自己的分支
git checkout -b feat/你的功能名
# 例如：git checkout -b feat/hunt-scoring
```

分支命名格式：`<类型>/<简短名称>`

| 前缀 | 用途 |
|---|---|
| `feat/` | 新功能 |
| `fix/` | 修 bug |
| `test/` | 写测试 |
| `docs/` | 改文档 |

## 第六步：写代码

**先把 issue 读一遍，再开始动手。** issue 里通常会写清楚：要实现什么、从哪个文件改起、如何验收。把 issue 内容丢给 AI，让它帮你理解要做什么，然后带着你一步步写。

推荐做法：用 VS Code 打开项目，启动 Claude Code 或 GitHub Copilot，把整个 `src/` 目录的结构让 AI 解释一遍，再告诉它你的 issue 要求，让它引导你。

> wolf 的代码结构是分层的：业务逻辑只能放在 `src/commands/`，不能放在 `src/cli/` 或 `src/mcp/`。如果不确定代码该放哪里，问 AI，或者看 [docs/ARCHITECTURE_zh.md](docs/ARCHITECTURE_zh.md)。

**测试骨架已经写好了——你的任务是让它们通过。**

wolf 采用测试驱动开发（TDD）。你要实现的每个函数，对应的 `__tests__/` 文件里都已经有测试骨架了，长这样：

```typescript
it.todo('returns a valid ScoringResponse and updates the job in DB');
```

`it.todo` 表示这个测试还没实现——它不会运行。当你写完函数之后，把每个 `it.todo` 改成真正的测试：

```typescript
it('returns a valid ScoringResponse and updates the job in DB', async () => {
  // 准备测试数据
  // 调用函数
  // 断言结果
});
```

测试文件和它测试的源文件放在同一层的 `__tests__/` 里：

```
src/utils/batch.ts  →  src/utils/__tests__/batch.test.ts
src/commands/score/index.ts  →  src/commands/score/__tests__/score.test.ts
```

运行测试：

```bash
npm test
```

所有 `it.todo` 的测试会显示为"todo"（不是失败）——就算有些函数还没实现，CI 也不会报红。一旦你把 todo 改成真正的测试，这个测试就必须通过，PR 才能被合并。

## 第七步：提交代码

> 写完代码之后，需要把改动"提交"（commit）到 git，然后"推送"（push）到你的 fork 上。不确定该怎么写 commit message，直接问 AI 或者用 VS Code 的 GitHub Copilot 自动生成。

```bash
# 把改动的文件加入暂存区（替换成你实际修改的文件路径）
git add <你改动的文件>

# 提交，写一句简短的说明
git commit -m "feat: add job deduplication logic"

# 推送到你的 fork
git push -u origin feat/你的功能名
```

> [!NOTE]
> commit message 的格式是 `类型: 简短描述`，用英文写。常用类型：`feat`（新功能）、`fix`（修 bug）、`test`（测试）、`docs`（文档）。

## 第八步：自己先用一遍（Dog Fooding）

> [!IMPORTANT]
> 提交 PR 之前，先把你写的东西自己跑一遍。测试通过不等于功能正确——测试是对代码逻辑的验证，不能替代真实使用。

**Dog fooding** 是一个工程术语，意思是"吃自己的狗粮"——用自己写的工具做一次真实的操作，而不只是看测试通过了就算完。

```bash
cd /path/to/wolf      # cd 到你的 wolf 项目根目录
npm run build         # 重新编译
npm install -g .      # 把 wolf 安装到本地，之后才能直接用 wolf 命令
wolf <你实现的命令>     # 真实跑一遍
```

过一遍这些问题：

- 功能在正常情况下是否按预期工作？
- 如果输入错误或漏填参数，报错信息是否清晰？
- 有没有出现你没预料到的行为？

如果发现问题，回到第六步修复，再重新测试。满意了再进下一步。

## 第九步：发 Pull Request

> Pull Request（PR）是你告诉项目 owner"我写完了，请帮我看看能不能合并进去"的方式。注意：PR 的目标是原始 wolf 仓库的 base branch，不是你自己的 fork。

1. 打开 [wolf 的 GitHub 页面](https://github.com/guanyu-gerry-tao/wolf)
2. GitHub 通常会自动弹出提示，点击 **"Compare & pull request"**
3. 确认 base branch 是 issue 里指定的那个（不是 main）
4. 写清楚你做了什么，关联对应的 issue（写 `Closes #issue编号`）
5. 提交，等待审核

## 遇到问题怎么办

1. **先问 AI**——把报错信息完整复制给 Claude 或 ChatGPT，让它解释并给出解决方案。90% 的问题都能这样解决。
2. **CI 跑不过**——点开 GitHub Actions 的报错信息，复制给 AI。
3. **还是搞不定**——联系项目 owner。


## 关键文档

| 文档 | 内容 |
|---|---|
| [docs/ARCHITECTURE_zh.md](docs/ARCHITECTURE_zh.md) | 代码结构和各层职责 |
| [docs/MILESTONES_zh.md](docs/MILESTONES_zh.md) | 路线图和任务清单 |
| [docs/TYPES_zh.md](docs/TYPES_zh.md) | 所有共享的 TypeScript 类型 |
| [CLAUDE.md](CLAUDE.md) | 项目概览（给 AI 工具看的） |
