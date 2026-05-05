# wolf companion

wolf companion 是一个 Chrome MV3 side panel extension，在浏览器里驱动 wolf。
它和本地的 `wolf serve` daemon 通过 `http://127.0.0.1:<port>` 通信，自己
**不会主动联外网**。

## 功能

- 一个面板，一个下一步。Hero 卡片永远显示当前流程里**最相关的那一步**：
  Connect → Import → Process → Tailor。
- 顶部有 4 段进度条，一眼看到自己在哪一步。
- Roadmap 区域（Score / Autofill / Reach out）把"还没做的"做成路线图卡片，
  而不是放半成品的按钮。
- Activity log 实时告诉你 wolf 刚做了什么。

## 为什么 wolf 用单独一个 Chrome 窗口

点 **Open wolf browser** 时，wolf 会启动一个**独立的 Google Chrome
实例**，profile 放在 workspace 下的
`<workspace>/data/wolf-browser-profile/`。**不复用**你日常的 Chrome。

老老实实讲，这是选了"麻烦但不坑"的一边。直接用主 profile 反而更坑：

1. **Chrome 的 user-data-dir 锁**。Playwright（wolf 驱动浏览器的引擎）
   需要独占 profile 目录。如果 wolf 用你的主 profile 而你日常 Chrome 还
   开着，必有一个起不来。每次应聘都要关掉日常 Chrome？不是产品。
2. **Google Sync 污染**。如果你主 profile 登了 Google 账号开了 Sync，
   wolf 浏览过的每个页面都会同步进你的个人历史，wolf 装的扩展会同步到
   你的其他设备。我们不想动你的账号状态。
3. **Stagehand 稳定性**。wolf 之后会用 Stagehand observe + replay 自动
   填表。主 profile 装的密码管理器、广告拦截、隐私扩展会以非常微妙的
   方式干扰自动化（这是社区记录多年的坑）。干净的 profile 才能让自动
   化稳定。
4. **企业 MDM**。一些被公司管控的 Chrome 直接禁止任意
   `--user-data-dir`。独立 profile 绕过这个限制。

代价是多走一次设置（在 wolf 窗口里登一次 LinkedIn / Greenhouse /
Workday，想用密码管理器就装一次）。之后这个 profile 会**永久持久化**，
之后每次 `wolf serve` 都复用同一份。

## 首次设置

1. `npm run build` 之后，Chrome 里 load unpacked `extension/dist/`。
2. 点 wolf companion 图标。side panel 打开，第一次会显示 Welcome 卡片，
   点 **Got it**。
3. 终端里跑 `wolf serve`，记下打印出的端口号。
4. side panel 右上角点 connection pill，粘贴端口，点 **Reconnect**。
5. 点 **Open wolf browser**，会弹出一个独立 Chrome 窗口。
6. 在**那个窗口**里登录你常用的求职网站。想装密码管理器就装在那里。
7. 在 wolf 窗口里打开一个职位页。回到 side panel 点 **Import**。Hero
   会推进到 **Process** → **Tailor**。

companion 跨 session 记住端口。wolf 浏览器 profile 永久持久化。

## 架构

side panel 是 Vite + React 18，用 `@crxjs/vite-plugin` 打包。状态用
单个 `useReducer` 通过 Context 暴露；副作用（心跳、run 轮询、Chrome
tab 监听）封装在 `extension/src/sidepanel/hooks/` 的 hook 里。Apple
风的 design tokens 定义在 `extension/tailwind.config.ts` 和
`extension/src/sidepanel/styles/index.css`。动画用 `framer-motion`，
图标用 `lucide-react`。

companion 支持 **demo 模式**：当作普通静态 HTML 页面跑（没有
`chrome.runtime`）时，自动降级为 `localStorage` 和宿主页 `document`。
这样视觉审查 harness 不需要加载 extension 也能跑。

## 视觉审查

`extension/test/visual/` 下有一套 Playwright 驱动的 harness，跨 3 档
真实 Chrome side panel 宽度抓取每个 UI 阶段的截图。命令：

```bash
cd extension && npm run review
```

harness 会启 mock daemon、静态 serve build 产物、用 Playwright 渲染
8 个命名场景 × 3 个 viewport = 24 张截图。输出在
`extension/test/visual/snapshots/current/`，外加一份 `report.md` 表格。

## FAQ

**能把主 Chrome profile 复制到 wolf profile 里吗？** 技术上可以（同
OS 用户共享 OSCrypt key），但不推荐。理由就是上面 4 条（Chrome 锁、
Sync 污染、Stagehand 干扰、MDM）。重新设置一份干净的 wolf profile
一小时之内能回本。

**companion 把端口存哪？** real extension 模式下用 `chrome.storage.local`，
demo 模式下用 `window.localStorage`（key 是 `wolfServePort`）。

**wolf 浏览器会出现在我 Chrome 同步历史里吗？** 不会。wolf profile 自
己一个 user-data-dir，默认不登 Google 账号。
