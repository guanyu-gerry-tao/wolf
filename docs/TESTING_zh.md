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

```bash
mkdir ~/test-wolf && cd ~/test-wolf
wolf init
```

**检查项：**
- [ ] 依次提示输入姓名、邮箱、电话、工作签证状态、目标岗位、目标地点
- [ ] 在 `~/test-wolf/` 生成 `wolf.toml`
- [ ] 生成 `data/` 目录
- [ ] `.gitignore` 中自动添加 `data/`
- [ ] 若未设置 `WOLF_ANTHROPIC_API_KEY`，提示运行 `wolf env set`
- [ ] 若已存在 `wolf.toml`，给出警告并备份为 `wolf.toml.backup1`

**测试输入示例：**
```
Name:              Alex Chen
Email:             alex@example.com
Phone:             555-000-0001
Work auth:         F-1 OPT, need sponsorship
Target roles:      Software Engineer, Backend Engineer
Target locations:  NYC, Remote
```

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

---

## 3. CLI：`wolf tailor`

将 `.tex` 简历放入 `~/test-wolf/resume/`，并在 `wolf.toml` 中设置 `resumePath`。

```bash
cp ~/path/to/wolf/samples/resume/Resume.tex ~/test-wolf/resume/

# 编辑 wolf.toml：设置 resumePath = "resume/Resume.tex"

wolf tailor --job <jobId>
```

**检查项：**
- [ ] 在 `data/<profile>/<jobSlug>/` 下生成 tailored 版 `.tex` 和 `.pdf`
- [ ] 简历在 1 页以内（或 `maxResumePages` 设置的页数）
- [ ] 无孤儿行（bullet 最后一行只有单个词）
- [ ] 精修循环有日志（最多 5 次迭代，LGTM 后提前退出）
- [ ] 生成截图 `.png`
- [ ] 返回 `tailoredPdfPath`、`screenshotPath`、`coverLetterPdfPath`（如已生成）

**带求职信：**
```bash
wolf tailor --job <jobId> --cover-letter
```
- [ ] 求职信 PDF ≤ 1 页

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

## 6. 测试轮次之间的清理

```bash
cd ~/test-wolf

wolf dev clean --jobs         # 删除 job 输出目录 + 清空 DB（保留模板）
wolf dev clean --all          # 上述 + 删除生成的模板
wolf dev clean --dangerousall # 清空所有 data/ 内容（需输入 "yes" 确认）
```

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
