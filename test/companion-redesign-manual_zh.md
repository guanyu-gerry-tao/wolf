# Companion 重设计 — 真人测试流程

React + Apple 风重设计 PR 的**一次性**人工验收，合并 `companion-redesign`
到 main 之前跑一遍。后续回归由 `npm run review`（状态矩阵 harness）和
单测兜底；这份文档是"真 Chrome 端到端"的那一遍。

> 时间预估：核心路径约 10 分钟（阶段 0–5 + 8 + 10），含付费 Process
> + Tailor AI 调用约 45 分钟。

---

## 阶段 0 — 准备（5 分钟）

```bash
cd /Users/guanyutao/developers/personal-projects/wolf/.claude/worktrees/wonderful-fermi-1a9b2d
git branch --show-current   # → companion-redesign
git log --oneline -10       # 能看到 S1..S8
npm install
npm run build --workspace=@wolf/companion
ls extension/dist/          # manifest.json + service-worker-loader.js + src/sidepanel/index.html
```

> **不要跑 `npm run dev --workspace=@wolf/companion`。** 那会启 Vite
> dev server，把 `dist/` 改成 HMR 模式（脚本指向 `localhost:5173`）。
> Chrome MV3 在 `chrome-extension://` scheme 下会拒绝这些 module 脚本，
> 报 `Failed to load module script: ... MIME type "application/octet-stream"`，
> side panel 变全白。**load unpacked 测试只用 `npm run build`**。
> 如果不小心跑了 dev，再跑一次 build 覆盖污染的 dist，然后在
> `chrome://extensions` 里 reload extension。

**通过条件：** `extension/dist/manifest.json` 和 `dist/src/sidepanel/index.html` 存在。

---

## 阶段 1 — 装到真 Chrome（5 分钟）

1. 地址栏 `chrome://extensions` → 右上角打开 **Developer mode**
2. **Load unpacked** → 选 **`extension/dist`**（build 产物）
   - ⚠️ **不要选 `extension/`**。选源码目录的话 manifest 能跑起来，
     但 side panel HTML 引用的文件没被打包，面板会**白屏且没明显报错**。
     如果你看到白屏，最常见原因就是这个 —— 在 `chrome://extensions`
     卡片上确认 Source 路径是 `.../extension/dist`，如果是
     `.../extension` 就 Remove 再 Load 一次正确路径。
3. 列表里出现 "**wolf companion** v0.0.23"，无红色错误横幅
4. 把 wolf 图标 pin 到工具栏

**通过条件：** 无报错、图标可见、Service worker 状态为 **inactive**（正常）。

---

## 阶段 2 — 首次打开 + Welcome 卡（2 分钟）

1. 点工具栏 wolf 图标 → side panel 在右侧打开
2. WelcomeCard spring 入场动画显示：
   - "WELCOME" eyebrow / "wolf is your job hunt copilot" 标题 / 30 字 body / 1-2-3 步骤列表 / 蓝色 **Got it** 按钮

**视觉检查：**
- [ ] system font（macOS 下是 SF Pro）
- [ ] **Got it** 是 Apple 系统蓝 `#0a84ff`
- [ ] 面板用 shadow 分层，无 1px solid border

3. 点 **Got it** → 卡片动画退出
4. DevTools → Application → Local Storage：`wolf.firstRunSeen=true`

**通过条件：** 卡片只显示一次，关闭顺畅，重开 panel 不再出现。

---

## 阶段 3 — Disconnected 状态（2 分钟）

side panel 上右键 → **Inspect**。然后：

1. **TopBar：** 左侧 brand + 右侧连接 pill（红点 · "Offline"）+ 齿轮按钮 + 标题下方 4 段 ProgressStrip
2. **Hero：** "STEP 1 OF 4 / Connect to wolf serve"，body 提到 `wolf serve`
3. **Roadmap（往下滚）：** 3 张卡 — Score / Autofill / Reach out — 每张有 🔒 图标 + 蓝色 timeline label；hover 时 opacity 从 0.78 → 1

**通过条件：** Console 全程**无红色 error**。允许：fetch 失败到 `127.0.0.1:47823`（daemon 还没起，预期）。

---

## 阶段 4 — 启动 daemon + 连接（5 分钟）

`wolf serve` **就是 daemon（仅 HTTP server）**。companion side panel 通过
`http://127.0.0.1:<port>` 跟它通信；不起来的话每个动作都会被拒绝。

> **注意：daemon 不会启动 wolf Chrome。** `wolf serve` 只起 HTTP server；
> wolf Chrome 窗口是**懒启动**的，由阶段 5 点 **Open wolf browser**
> 触发 `POST /api/browser/open` 才打开。这是设计如此 —— daemon 保持轻量，
> 你可以在 Chrome 启动前就连上 side panel（比如只想看 status）。
> runtime overlay 会在需要 Chrome 时提示你点按钮。

整个测试**用真实的前台 terminal 窗口跑**（两个可见的 session，
**terminal A** 和 **terminal B**）。不要 `&` 后台 serve，不要 `nohup`，
不要 `tmux detach`。把进程留在真 terminal 里，才能实时看 heartbeat 日志、
能 Ctrl-C 干净关 daemon、能立刻观察错误。

这一阶段用 **`/tmp/wolf-test/` 下的临时 workspace**，所以阶段 5 创建的
wolf 浏览器 profile 会落在
`/tmp/wolf-test/manual-companion-<id>/ws/data/wolf-browser-profile/`，
不污染你日常 workspace。这跟 CLAUDE.md 里"smoke / acceptance 测试只能
用 `/tmp/wolf-test/` 路径"的规则一致。

### 4a — 编译 dev binary（每个 session 一次）

**terminal A**：

```bash
cd /Users/guanyutao/developers/personal-projects/wolf
npm run build:dev   # 出 dist/cli/index.js（dev workspace 用）
```

### 4b — 初始化临时 workspace（一次）

**terminal B**（这个保持开着跑 serve）：

```bash
# 临时 workspace 路径；init 和 serve 用同一个值
export WOLF_DEV_HOME="/tmp/wolf-test/manual-companion-$(date +%Y%m%d-%H%M%S)/ws"
mkdir -p "$WOLF_DEV_HOME"

# 一次性 init 这个临时 workspace（不弹问题）
node dist/cli/index.js init --here --empty --dev
```

### 4c — 启动 daemon（前台跑，保持打开）

仍然在 terminal B（前台跑，挂在真 terminal 上 —— **不要 `&`，
不要 `nohup`，不要 detach**）：

```bash
node dist/cli/index.js serve --port 47823
```

等到 `wolf serve listening on http://127.0.0.1:47823`。**直到阶段 7
跑完之前都不要关这个 terminal** —— side panel 每个动作都需要 daemon
活着。wolf 浏览器 profile 只有在你阶段 5 点 **Open wolf browser** 时
才会被创建在 `$WOLF_DEV_HOME/data/wolf-browser-profile/` 下；
现在 `data/` 还是空的。

### 4d — 在 side panel 里 Reconnect

回到 side panel：

1. 点 ConnectionPill → popover 滑出
2. 确认 port = 47823，点 **Reconnect**
3. pill 状态：idle（黄点）→ connected（绿点 + `:47823`）
4. Activity log: "Connected: wolf <version>"
5. Hero 切到 "STEP 1 OF 4 / Open wolf browser"，body 解释**独立 Chrome
   profile** 的理由（这就是 Q1 老实文案 —— 看一下读着对不对）

**通过条件：** pill 转绿、Hero 推进、Activity log 有记录。terminal B
每 5 秒打一条 GET /api/runtime/status（heartbeat）—— 正常。

> **整轮跑完之后清理：** `rm -rf /tmp/wolf-test/manual-companion-*`
> 一键删掉 workspace + wolf 浏览器 profile。你真实的 `~/wolf/`（或者
> stable workspace 在哪里）**不会被碰**。

---

## 阶段 5 — 打开 wolf browser（3 分钟）

1. 点 **Open wolf browser**（Hero 里或 pill popover 里）
2. terminal: `POST /api/browser/open`
3. 弹出新的 Chrome 窗口（独立 profile，blank/about:blank）
4. side panel:
   - [ ] runtimeOverlay 消失
   - [ ] Hero 切到 "STEP 2 OF 4 / Import a job posting"
   - [ ] ProgressStrip 第 1 段变蓝（active）

**验证 profile 隔离：**
- 新 Chrome 窗口的 `chrome://version` → **Profile Path** 应在
  `/tmp/wolf-test/manual-companion-<时间戳>/ws/data/wolf-browser-profile/...`
  （跟阶段 4b 的 `$WOLF_DEV_HOME` 对得上）
- 你日常 Chrome 的 cookies / 历史**未被改动**

**通过条件：** 两个 Chrome 进程并存，日常浏览器没被碰。

---

## 阶段 6 — Import → Process → Tailor（10 分钟，付费）

在 wolf 窗口里打开一个真实的职位页（推荐 `jobs.lever.co/...` 或
`boards.greenhouse.io/...` —— **避开 LinkedIn**，可能要登录）。

1. **Import**（免费）：side panel → **Import this page**
   - Activity log: "Imported page to wolf inbox: <id>"
   - Hero 推进到 "STEP 3 OF 4 / 1 imported page ready"
2. **Process**（付费 Claude API 调用）：点 **Process Inbox (1)** → 确认
   - 5 秒后 Hero 显示 "wolf is working" + Check run
   - 跑完 Hero 切到 "STEP 4 OF 4 / X jobs ready to tailor"
3. **Tailor**（付费）：点 **Batch Tailor (X)**
   - Hero 切到 "All caught up / Resume + cover letter ready"
   - Resume + Cover Letter 按钮变绿色

**通过条件：** 每个阶段的 Hero 文案匹配，Activity log 记录每个状态切换。
不想花 AI 钱可跳过 2-3，最少跑通 1。

---

## 阶段 7 — Settings + Edit modal（3 分钟）

1. 点 ⚙️ 齿轮 → Settings 面板出现
2. 改任意字段（如 Hunt minScore 0.5 → 0.6）→ **Save Config**
   - terminal: `POST /api/config`
   - `wolf.toml` 被写入
3. **Back** → 回主视图

如果 Resume 已 ready（阶段 6 跑完）：

4. 点 **Resume** → wolf 窗口新开 tab 显示预览
5. side panel 切到 artifact-edit 视图
6. 在 textarea 输入修改指令 → **Regenerate Resume**（付费，可选）
7. **Back** → 回主视图，textarea 已清空

**通过条件：** modal 进出顺畅、表单值持久化、不崩溃。

---

## 阶段 8 — Resize（2 分钟）

拖 side panel 左边缘走三档宽度：

- [ ] **~280–320 px（narrow）：** TopBar 不溢出，Hero/Roadmap 正确换行，queue 横向滚动
- [ ] **~400 px（default）：** 基线
- [ ] **~560 px（wide）：** 内容撑满，无水平滚动条

**通过条件：** 三档都不崩。

---

## 阶段 9 — Reduce-motion（1 分钟，仅 macOS）

1. 系统设置 → 辅助功能 → 显示器 → 勾选 **减少动态效果**
2. 关掉 + 重开 side panel（或重 load extension）
3. WelcomeCard 瞬间显示（无 spring）；Hero phase 切换无动画
4. **测完关掉这个系统设置**

**通过条件：** prefers-reduced-motion 下动画 fallback 到 instant。

---

## 阶段 10 — 视觉审查 harness（5 分钟）

```bash
cd extension
npm run review
```

输出：

```
[harness] 24 screenshots → .../snapshots/current
[harness] report → .../report.md
```

打开 `extension/test/visual/snapshots/current/`，每个命名状态的
default 宽度 PNG 都瞄一眼：

- [ ] `first-run--default.png` — WelcomeCard 居中，蓝色 Got it
- [ ] `disconnected--default.png` — 无 welcome，hero "Connect to wolf serve"
- [ ] `connected-empty--default.png` — hero "Import a job posting"
- [ ] `has-imports--default.png` — 蓝色 Process Inbox CTA
- [ ] `has-processed--default.png` — hero "X jobs ready to tailor"
- [ ] `has-tailored--default.png` — hero "All caught up"
- [ ] `runtime-not-ready--default.png` — 黄色 runtimeOverlay
- [ ] `config-open--default.png` — Settings 表单完整渲染

narrow（320）和 wide（560）扫一眼有没有布局崩。

---

## 失败上报模板

某阶段失败的话，捕获：

```
阶段：N
失败步骤：<描述>
预期：<本来应该发生什么>
实际：<实际发生了什么>
DevTools console error：<贴出来，如有>
Terminal stderr：<贴出来，如有>
截图：<路径或附件>
```

把这一块整体回贴，比"在线 debug"快。

---

## 全部通过之后

```bash
# 可选：把 baseline 固化进 git，将来 review 跑能 diff
mkdir -p extension/test/visual/snapshots/baseline
cp extension/test/visual/snapshots/current/*.png extension/test/visual/snapshots/baseline/
git add extension/test/visual/snapshots/baseline
git commit -m "test(extension): seed visual review baseline (S7 follow-up)"

# Push + 开 PR
git push -u origin companion-redesign
gh pr create --title "Companion redesign: React + Vite + Apple style" --body "<见 plan>"
```

最低过线阶段：**0、1、2、3、8、10**（零 AI 成本）。阶段 4–7 和 9 推荐但非阻塞。
