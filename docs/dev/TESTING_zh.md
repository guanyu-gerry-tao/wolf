# 手动测试指南

在合并到 main 之前，逐步验证 wolf 本地运行情况。

---

## 前置准备

> **注意：** `wolf init` 会在**当前目录**创建 `wolf.toml` 和 `data/`。
> 务必先 `cd` 到专用的测试目录，**不要在 wolf 项目仓库目录里运行**。

```bash
# 0. 创建专用测试目录（第一步！）
mkdir ~/wolf && cd ~/wolf

# 1. 编译并全局安装（在 wolf repo 目录下执行）
cd ~/path/to/wolf
npm run build
npm link            # 将 'wolf' 注册为全局命令
wolf --help         # 确认生效

# 2. 确认 API key 已设置
wolf env show
# WOLF_ANTHROPIC_API_KEY 应显示为 [set]

# 3. 切换到测试目录
cd ~/wolf
```

---

## 1. CLI：`wolf init`

> **测试顺序说明：** 先测不产生文件的取消场景（无需清理），再测会留下文件的场景，最后跑完整正常路径并保留 workspace 供后续步骤使用。

---

### 场景 1A：取消 — 路径确认选 N

不会创建任何文件，无需清理，直接接着测下一个。

```bash
cd ~/wolf
wolf init
# "Create workspace here?" 选 N
```

**检查项：**
- [x] 显示"Cancelled. cd to your preferred directory and run wolf init again."
- [x] 没有任何文件被创建（`ls ~/wolf` 应为空）

---

### 场景 1B：取消 — 已有 wolf.toml 时拒绝覆盖

需要先有一个 `wolf.toml`；用下面的一行命令快速创建一个占位文件，然后跑 init：

```bash
touch ~/wolf/wolf.toml
wolf init
# "Create workspace here?" 选 Y
# "Overwrite existing config?" 选 N
```

**检查项：**
- [x] 显示"Existing wolf.toml detected."并警告会覆盖
- [x] 拒绝后，提示"Cancelled. Existing config unchanged."
- [x] `wolf.toml` 内容不变（仍是空文件）

清理：

```bash
rm ~/wolf/wolf.toml
```

---

### 场景 1C：正常路径 — 跳过简历编辑，留下 workspace 供覆盖测试

```bash
cd ~/wolf
wolf init
# 按提示填写姓名、邮箱等；编辑器打开后直接关闭（不填内容）
```

**检查项：**
- [x] `wolf.toml` 在 `~/wolf/` 生成
- [ ] `profiles/default_default/resume_pool.md` 生成，内容为模板（带 `# SUMMARY` 等占位符）
- [ ] `.gitignore` 包含 `.env` 和 `data/`（不包含 `profiles/`）
- [x] 完成后显示 API key 状态（✓/✗ 各个 key）

> 不要清理，直接跑下一个场景。

---

### 场景 1D：警告 — 已存在 wolf.toml，确认覆盖

在 1C 的基础上直接再跑一次：

```bash
wolf init
# "Create workspace here?" 选 Y
# "Overwrite existing config?" 选 Y
# 重新填写信息，编辑器打开后填入真实简历内容（复制 samples/resume/resume_pool_sample.md 内容）
```

**检查项：**
- [x] 显示"Existing wolf.toml detected."并警告会覆盖
- [x] 确认后，旧文件备份为 `wolf.toml.backup1`
- [ ] 完整走完流程，`profiles/default_default/resume_pool.md` 包含填写的内容
- [x] 启动时显示当前路径，询问"Create workspace here?"
- [x] 依次提示输入姓名、邮箱、电话、工作签证状态、目标岗位、目标地点
- [x] 编辑器打开 `resume_pool.md`，填写后按 Enter 继续
- [ ] 完成后显示 `profiles/default_default/resume_pool.md` 的绝对路径
- [x] 提示下一步：`wolf templategen`

> **保留这个 workspace**，直接进入步骤 2。

---

## 2. CLI：`wolf templategen`

`wolf tailor` 依赖 `resume_pool.md`（内容池）和 `data/<profile>/general_resume/resume.tex`（模板）。

```bash
cd ~/wolf
# 确认 resume_pool.md 有内容
cat profiles/default_default/resume_pool.md

wolf templategen
```

**检查项：**
- [ ] 在 `data/default_default/general_resume/` 下生成 `resume.tex`、`resume.pdf`、`resume.png`
- [ ] PDF 可以正常打开，内容来自 `profiles/default_default/resume_pool.md`
- [ ] 终端逐步显示进度（Reading → Calling Claude → Writing → Compiling → Screenshot）
- [ ] 无报错

---

## 3. CLI：`wolf add`

```bash
cd ~/wolf
wolf add \
  --title "Software Engineer, Backend Platform" \
  --company "Stripe" \
  --jd "$(cat ~/path/to/wolf/samples/jd/jd1_clean_bullets.txt)"
```

**检查项：**
- [ ] 返回包含 `jobId` 的 job 对象
- [ ] 无报错

记录 `jobId`，后续 `wolf tailor` 需要用到。

**用不同格式的 JD 各跑一次：**

| JD 文件 | 预期 |
|---|---|
| `jd1_clean_bullets.txt` | 正常 |
| `jd3_mixed.txt` | 正常 |
| `jd5_wall_of_text.txt` | 正常（解析鲁棒性） |

---

## 4. CLI：`wolf tailor`

> **前置依赖：** 必须先完成步骤 2（wolf templategen），否则会报 `resume_pool.md not found`。

### 场景 4A：正常路径 — 无求职信

```bash
wolf tailor --job <jobId>
```

**检查项：**
- [ ] 在 `data/default_default/<jobSlug>/` 下生成 `.tex` 和 `.pdf`
- [ ] PDF ≤ 1 页（或 `maxResumePages` 设定值）
- [ ] 无孤儿行（bullet 最后一行只有单个词）
- [ ] 终端有精修循环日志（最多 5 次，LGTM 后提前退出）
- [ ] 生成截图 `.png`

---

### 场景 4B：正常路径 — 带求职信

```bash
wolf tailor --job <jobId> --cover-letter
```

**检查项：**
- [ ] 额外生成 `cover_letter.pdf`
- [ ] 求职信 PDF ≤ 1 页

---

### 场景 4C：不同格式的 JD

用 `wolf dev clean --jobs` 清理后，重新 add 不同 JD，各跑一次 tailor：

| JD 文件 | 关注点 |
|---|---|
| `jd2_paragraphs.txt` | 纯段落 JD，内容提取是否正确 |
| `jd4_minimal.txt` | 极简 JD，简历内容是否适度调整 |
| `jd5_wall_of_text.txt` | 超长段落，不应崩溃 |

---

## 5. MCP：`wolf_setup`

在 `~/Library/Application Support/Claude/claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "wolf": {
      "command": "wolf",
      "args": ["mcp", "serve"],
      "env": {
        "WOLF_ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

重启 Claude Desktop，在新对话中说：

> "帮我设置 wolf"

**检查项：**
- [ ] Claude 在询问信息前先提示 API key（"在终端运行 `wolf env set`"）
- [ ] Claude 通过对话收集姓名、邮箱、电话、签证状态、目标岗位、地点
- [ ] Claude 询问简历内容（summary/education/experience/projects/skills）
- [ ] Claude 最后一次性调用 `wolf_setup`，包含所有字段和 `resumeText`
- [ ] 在 `wolf mcp serve` 启动目录下生成 `wolf.toml` 和 `profiles/default_default/resume_pool.md`
- [ ] 返回 `resume_pool.md` 路径和下一步提示

---

## 6. MCP：`wolf_update_resume`

在 Claude Desktop 中：

> "帮我更新简历，我有一份新的工作经历要加进去"

**检查项：**
- [ ] Claude 询问新的内容（哪个 section 要更新）
- [ ] Claude 调用 `wolf_update_resume`，传入更新后的完整 `resumeText`
- [ ] `profiles/default_default/resume_pool.md` 内容已更新
- [ ] Claude 提示运行 `wolf_templategen` 重新生成模板

---

## 7. MCP：`wolf_tailor`

在 Claude Desktop 中（wolf_setup 完成后，已有 job 记录）：

> "帮我针对 job ID \<jobId\> 定制简历"

**检查项：**
- [ ] Claude 调用 `wolf_tailor`，传入 jobId
- [ ] 响应中内嵌简历截图
- [ ] 列出修改内容和匹配分数
- [ ] 以代码块形式展示文件路径，方便一键复制上传

---

## 8. 重置与清理

### 清理 job 数据（保留配置，重跑 tailor 场景）

```bash
cd ~/wolf
wolf dev clean --jobs         # 删除 job 输出目录 + 清空 DB（保留模板）
wolf dev clean --all          # 上述 + 删除生成的模板
wolf dev clean --dangerousall # 清空所有 data/ 内容（需输入 "yes" 确认）
```

### 清理 init 中途取消的残留

`wolf init` 中途取消时，`data/` 已创建但 `wolf.toml` 未生成：

```bash
cd ~/wolf
rm -rf data/
wolf init
```

### 完全重置测试目录（从头来过）

```bash
rm -rf ~/wolf
mkdir ~/wolf && cd ~/wolf
wolf init
```

### 重置 API keys

```bash
# 从 RC 文件中删除
wolf env clear

# 在当前 session 立刻生效（wolf env clear 完成后会打印这行）：
unset WOLF_ANTHROPIC_API_KEY && unset WOLF_APIFY_API_TOKEN && unset WOLF_GMAIL_CLIENT_ID && unset WOLF_GMAIL_CLIENT_SECRET

# 验证已清空
wolf env show

# 重新设置
wolf env set
```

> **注意：** `source ~/.zshrc` 不能清掉已在 session 中的变量，只有 `unset` 或新开 terminal 才有效。

---

## 样例 JD

位于 `samples/jd/`，用于覆盖不同的 JD 格式场景：

| 文件 | 格式 | 适合测试 |
|---|---|---|
| `jd1_clean_bullets.txt` | 干净 bullet list | 基础 / 正常路径 |
| `jd2_paragraphs.txt` | 纯段落 | 无结构 JD 的解析能力 |
| `jd3_mixed.txt` | 段落 + bullet 混合 | 最常见的真实场景 |
| `jd4_minimal.txt` | 极简 | 超短 JD 边界情况 |
| `jd5_wall_of_text.txt` | 一整段 | 解析鲁棒性压测 |
