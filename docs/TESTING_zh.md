# 手动测试指南

在合并到 main 之前，逐步验证 wolf 本地运行情况。

---

## 前置准备

> **注意：** `wolf init` 会在**当前目录**创建 `wolf.toml`、`data/` 和 `resume/`。
> 务必先 `cd` 到专用的测试目录，**不要在 wolf 项目仓库目录里运行**。

```bash
# 0. 创建专用测试目录（第一步！）
mkdir ~/test-wolf && cd ~/test-wolf

# 1. 编译并全局安装（在 wolf repo 目录下执行）
cd ~/path/to/wolf
npm run build
npm link            # 将 'wolf' 注册为全局命令
wolf --help         # 确认生效

# 2. 确认 API key 已设置
wolf env show
# WOLF_ANTHROPIC_API_KEY 应显示为 [set]

# 3. 切换到测试目录
cd ~/test-wolf
```

---

## 1. CLI：`wolf init`

每个场景测试完后，用 `wolf dev clean --dangerousall` 清理，或删除整个 `~/test-wolf` 重建。

### 场景 1A：正常路径 — 使用 .tex 简历（推荐）

```bash
cd ~/test-wolf
wolf init
# 提示"Create workspace here?"时确认
# 提示"Press Enter once your resume is in place..."之前，在另一个终端：
cp ~/path/to/wolf/samples/resume/Resume.tex ~/test-wolf/resume/
# 然后回来按回车
```

**检查项：**
- [ ] 启动时显示当前路径，询问"Create workspace here?"
- [ ] 在 `resume/` 中自动识别到 `Resume.tex`，显示"Auto-selected: resume/Resume.tex"
- [ ] `wolf.toml` 中 `resumePath = "resume/Resume.tex"`
- [ ] 生成 `data/` 目录和 `.gitignore`（含 `data/` 条目）
- [ ] 完成后提示运行 `wolf env set`（如未设置 key）

---

### 场景 1B：正常路径 — 使用 .pdf 简历

```bash
cd ~/test-wolf
wolf init
# 提示等待时放入 PDF：
cp ~/path/to/wolf/samples/resume/Resume.pdf ~/test-wolf/resume/
```

**检查项：**
- [ ] 自动识别到 `.pdf` 文件，`wolf.toml` 中 `resumePath = "resume/Resume.pdf"`
- [ ] 其余与 1A 相同

---

### 场景 1C：正常路径 — 多个文件，手动选择

```bash
cd ~/test-wolf
wolf init
# 提示等待时同时放入 tex 和 pdf：
cp ~/path/to/wolf/samples/resume/Resume.tex ~/test-wolf/resume/
cp ~/path/to/wolf/samples/resume/Resume.pdf ~/test-wolf/resume/
```

**检查项：**
- [ ] 出现选择菜单"Multiple resume files found — pick one"
- [ ] 选择后 `wolf.toml` 中 `resumePath` 为所选文件

---

### 场景 1D：错误 — 文件夹为空，重试成功

```bash
cd ~/test-wolf
wolf init
# 提示等待时不放任何文件，直接按回车
# 出现"No resume files found. Try again?"时选 Y
# 然后在另一个终端放入文件，再回来
cp ~/path/to/wolf/samples/resume/Resume.tex ~/test-wolf/resume/
```

**检查项：**
- [ ] 提示"No resume files found in resume/. Try again?"
- [ ] 重试时识别到文件，正常继续

---

### 场景 1E：错误 — 文件夹为空，放弃

```bash
cd ~/test-wolf
wolf init
# 提示等待时不放文件，直接按回车
# "Try again?"时选 N
```

**检查项：**
- [ ] 显示"Cancelled. Re-run wolf init once your resume is ready."
- [ ] **不生成** `wolf.toml`（流程中止在写入前）

> ⚠️ 注意：此场景下 `resume/` 和 `data/` 目录已创建，但 `wolf.toml` 未生成。

---

### 场景 1F：错误 — 重试后仍为空

```bash
cd ~/test-wolf
wolf init
# 两次都不放文件
# "Try again?"时选 Y，第二次仍为空
```

**检查项：**
- [ ] 显示"Still no files found. Cancelled."
- [ ] 流程终止，`wolf.toml` 未生成

---

### 场景 1G：警告 — 取消路径确认

```bash
cd ~/test-wolf
wolf init
# "Create workspace here?"时选 N
```

**检查项：**
- [ ] 显示"Cancelled. cd to your preferred directory and run wolf init again."
- [ ] 目录中没有任何新文件被创建

---

### 场景 1H：警告 — 已存在 wolf.toml（重新初始化）

```bash
# 先跑一次完整 init，然后再跑一次
cd ~/test-wolf
wolf init
```

**检查项：**
- [ ] 显示"Existing wolf.toml detected."并警告会覆盖
- [ ] 确认后，旧文件备份为 `wolf.toml.backup1`
- [ ] 拒绝后，提示"Cancelled. Existing config unchanged."，原文件不变

---

## 2. CLI：`wolf add`

```bash
cd ~/test-wolf
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

## 3. CLI：`wolf tailor`

### 场景 3A：正常路径 — .tex + 无求职信

```bash
# 确保 wolf.toml 中 resumePath = "resume/Resume.tex"
wolf tailor --job <jobId>
```

**检查项：**
- [ ] 在 `data/default_Default/<jobSlug>/` 下生成 `.tex` 和 `.pdf`
- [ ] PDF ≤ 1 页（或 `maxResumePages` 设定值）
- [ ] 无孤儿行（bullet 最后一行只有单个词）
- [ ] 终端有精修循环日志（最多 5 次，LGTM 后提前退出）
- [ ] 生成截图 `.png`

---

### 场景 3B：正常路径 — 带求职信

```bash
wolf tailor --job <jobId> --cover-letter
```

**检查项：**
- [ ] 额外生成 `cover_letter.pdf`
- [ ] 求职信 PDF ≤ 1 页

---

### 场景 3C：不同格式的 JD

用 `wolf dev clean --jobs` 清理后，重新 add 不同 JD，各跑一次 tailor：

| JD 文件 | 关注点 |
|---|---|
| `jd2_paragraphs.txt` | 纯段落 JD，内容提取是否正确 |
| `jd4_minimal.txt` | 极简 JD，简历内容是否适度调整 |
| `jd5_wall_of_text.txt` | 超长段落，不应崩溃 |

---

## 4. MCP：`wolf_setup`

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
- [ ] Claude 通过对话逐步收集姓名、邮箱、电话、签证状态、目标岗位、地点
- [ ] Claude 最后一次性调用 `wolf_setup`，包含所有字段
- [ ] 在 `wolf mcp serve` 启动目录下生成 `wolf.toml`
- [ ] 返回下一步提示：运行 `wolf env set`，然后运行 `wolf_templategen`

---

## 5. MCP：`wolf_tailor`

在 Claude Desktop 中（wolf_setup 完成后，已有 job 记录）：

> "帮我针对 job ID \<jobId\> 定制简历"

**检查项：**
- [ ] Claude 调用 `wolf_tailor`，传入 jobId
- [ ] 响应中内嵌简历截图
- [ ] 列出修改内容和匹配分数
- [ ] 以代码块形式展示文件路径，方便一键复制上传

---

## 6. 重置与清理

### 清理 job 数据（保留配置，重跑 tailor 场景）

```bash
cd ~/test-wolf
wolf dev clean --jobs         # 删除 job 输出目录 + 清空 DB（保留模板）
wolf dev clean --all          # 上述 + 删除生成的模板
wolf dev clean --dangerousall # 清空所有 data/ 内容（需输入 "yes" 确认）
```

### 清理 init 中途取消的残留

`wolf init` 中途取消时，`resume/` 和 `data/` 已创建，但 `wolf.toml` 未生成。可以直接删除这两个目录后重跑：

```bash
cd ~/test-wolf
rm -rf resume/ data/
wolf init
```

### 完全重置测试目录（从头来过）

```bash
rm -rf ~/test-wolf
mkdir ~/test-wolf && cd ~/test-wolf
# 然后重新跑 wolf init
```

### 重置 API keys

```bash
# 从 RC 文件中删除
wolf env clear

# 删除后在当前 session 立刻生效（wolf env clear 完成后会打印这行）：
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
