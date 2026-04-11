# wolf fill — 填表框架设计文档

## 为什么这样设计

### 核心问题
自动填表有两个根本矛盾：

1. **反检测 vs 可编程**：Playwright 直接启动 Chromium 会设置 `navigator.webdriver = true`，被招聘平台检测为机器人。但用真实 Chrome 又难以编程控制。
2. **AI 效率 vs 执行效率**：让 AI 逐步决策每个填写动作（Browser MCP 模式）token 消耗极大；但纯规则填表又无法理解多样的表单结构。

### 解法
**Playwriter = 真实 Chrome + 完整 Playwright API**

Playwriter 通过 Chrome 插件把用户真实 Chrome 的 CDP 控制权暴露出来，Playwright 通过 `connectOverCDP` 连接。结果：
- 没有 `navigator.webdriver` 标志（真实 Chrome）
- 继承用户的 Cookie、登录态、浏览器指纹
- 拥有完整 Playwright API（包括文件上传）

**AI 只做一件事：理解 → 映射**

AI（Claude）只负责读取表单结构并生成字段映射，不参与执行。执行完全由程序控制，无需 AI 往返。

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  wolf fill <url>                                        │
│                                                         │
│  ① startPlayWriterCDPRelayServer()                      │
│     └─ 启动本地 WebSocket 中继 (localhost:19988)         │
│     └─ 等待插件稳定连接（2秒）                            │
│                                                         │
│  ② chromium.connectOverCDP(getCdpUrl())                 │
│     └─ 通过 CDP 连接用户真实 Chrome                      │
│     └─ 获得完整 Playwright browser 对象                  │
│                                                         │
│  ③ page.evaluate()  ← 一次 DOM 遍历                     │
│     └─ 提取所有 input/select/textarea                   │
│     └─ 输出：aria-label + type 的文本列表               │
│                                                         │
│  ④ Claude API  ← 一次推理                               │
│     └─ 输入：表单结构 + 用户 profile                    │
│     └─ 输出：FieldMapping[] JSON                        │
│                                                         │
│  ⑤ executeFill()  ← 无 AI，纯程序循环                   │
│     └─ type  → locator.fill()                          │
│     └─ select → locator.selectOption()                 │
│     └─ upload → locator.setInputFiles()                │
│     └─ click  → 阻断（用户手动提交）                    │
│                                                         │
│  ⑥ page.screenshot() → 审计截图                        │
└─────────────────────────────────────────────────────────┘
```

---

## Relay Server 是什么

Chrome 插件和 Playwright 说不同的语言，relay server 是中间人：

```
用户真实 Chrome
  └── Playwriter 插件
        ↕  Chrome Extension API
      Relay Server (localhost:19988)
        ↕  CDP 协议
      Playwright connectOverCDP
        ↕
      wolf 代码
```

**关键特性：**
- Singleton：已经在跑就不会重复启动
- 轻量：几乎不占资源，适合常驻
- 插件连接时机：插件初始化时会短暂产生多个连接，需等 2 秒让其稳定

**推荐用法：** `wolf mcp serve` 启动时顺手启动 relay server，常驻后台，`wolf_fill` 随时可用。

---

## 字段提取策略

当前实现（`page.evaluate`）：

```typescript
document.querySelectorAll('input, select, textarea').forEach(el => {
  const ariaLabel = el.getAttribute('aria-label');
  const label = document.querySelector(`label[for="${id}"]`)?.textContent;
  // 优先 aria-label，fallback 到 label 文本（去掉 * 号）
});
```

**输出格式给 Claude：**
```
text | aria-label="First Name"
email | aria-label="Email Address"
select | aria-label="Are you authorized to work in the US?"
```

**已知局限（M4 需改进）：**
- 不处理 Shadow DOM（Workday）
- 不处理 iframe 内的表单
- 不处理动态渲染后才出现的字段

---

## Claude Mapping 格式

```typescript
interface FieldMapping {
  label: string;   // 对应 aria-label，直接用于 locator
  role: string;    // textbox / combobox / tel 等
  action: 'type' | 'select' | 'upload' | 'skip' | 'click';
  value: string | null;
}
```

**Prompt 设计原则：**
- 要求返回纯 JSON，不要 markdown 包裹
- `label` 必须是 aria-label 的原始值（直接用于定位元素）
- 不确定的字段 action 设为 `skip`

---

## Locator 策略

当前实现（POC 阶段，mock form 有干净 aria-label，够用）：
```typescript
page.locator(`[aria-label="${field.label}"]`)
```

**M4 需要的通用 fallback 链：**
```typescript
async function locateField(page, label) {
  // 1. aria-label 精确匹配
  let loc = page.locator(`[aria-label="${label}"]`);
  if (await loc.count() > 0) return loc;

  // 2. <label for> 关联
  loc = page.getByLabel(label, { exact: true });
  if (await loc.count() > 0) return loc;

  // 3. placeholder
  loc = page.getByPlaceholder(label, { exact: true });
  if (await loc.count() > 0) return loc;

  // 4. name 属性
  loc = page.locator(`[name="${label}"]`);
  if (await loc.count() > 0) return loc;

  return null;
}
```

---

## 多页表单处理

当前 POC 只处理单页。多页（Workday 等）的扩展方式：

```typescript
while (true) {
  const fields = await extractFields(page);
  const mapping = await analyzeForm(fields);   // 每页一次 AI 推理
  await executeFill(page, mapping);

  const nextBtn = await findNextButton(page);
  if (!nextBtn) break;

  await nextBtn.click();
  await page.waitForLoadState('networkidle');
}
// 最后一页：等用户手动 Submit
```

**每页单独推理**是正确做法：你看不到后面的页面，无法预先分析。

---

## 动态字段 & 验证错误处理

**条件字段**（填完一个字段后出现新字段）：
```typescript
// 填完后 re-snapshot，和之前对比
const before = await extractFields(page);
await fill(field);
await page.waitForTimeout(300); // 等 React 重渲染
const after = await extractFields(page);
const newFields = diff(before, after);
if (newFields.length > 0) {
  const extraMapping = await analyzeForm(newFields); // 只分析新字段
  await executeFill(page, extraMapping);
}
```

**验证错误**（点 Next 后页面没跳转）：
```typescript
await nextBtn.click();
await page.waitForTimeout(1000);
const errors = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="alert"], .error'))
    .map(el => el.textContent?.trim())
);
if (errors.length > 0) {
  // 把错误信息 + 当前 snapshot 发给 Claude，请它修正 mapping
  const fixedMapping = await analyzeFormWithErrors(snapshot, errors);
  await executeFill(page, fixedMapping);
}
```

---

## 安全设计

| 原则 | 实现 |
|---|---|
| 绝不自动提交 | `click` action 在代码里被阻断，Submit 按钮只打印跳过日志 |
| 用户确认 | 执行前打印完整 mapping，输入 `y` 才继续 |
| 审计截图 | 填完后截图保存，路径打印到终端 |
| 数据留本地 | Playwriter relay 只在 localhost，不经过任何外部服务 |

---

## 如何扩展为生产模块

### 1. 接入 wolf MCP

```typescript
// src/commands/fill/index.ts
import { startPlayWriterCDPRelayServer } from 'playwriter';
import { chromium } from 'playwright-core';

export async function fill(options: FillOptions): Promise<FillResult> {
  await startPlayWriterCDPRelayServer();
  const browser = await chromium.connectOverCDP(getCdpUrl());
  // ... 同 POC 流程
}
```

```typescript
// src/mcp/tools/fill.ts — MCP tool 包装
server.tool('wolf_fill', { url: z.string(), dryRun: z.boolean().optional() },
  async ({ url, dryRun }) => {
    const result = await fill({ url, dryRun });
    return result;
  }
);
```

### 2. 接入真实 Profile

替换 `TEST_PROFILE` 为从 `wolf.toml` 读取的用户配置：

```typescript
import { loadConfig } from '../../utils/config.js';
const profile = await loadConfig();
```

### 3. 接入 SQLite

填完后更新 job 状态：

```typescript
await db.run('UPDATE jobs SET status = ? WHERE id = ?', ['applied', jobId]);
```

### 4. 批量填表

```typescript
const jobs = await db.all('SELECT * FROM jobs WHERE status = "new"');
for (const job of jobs) {
  const page = await context.newPage();  // 每个 job 开一个 tab
  await fillPage(page, job.url);
  // tab 保持开着，用户逐一检查后手动 Submit
}
```

### 5. 验证码 / 登录墙检测

填表前用 AI 读取页面文字，判断是否进入验证阶段，而非写死选择器：

```typescript
async function detectBlocker(page): Promise<'form' | 'verification'> {
  const { title, text } = await page.evaluate(() => ({
    title: document.title,
    text: document.body.innerText.slice(0, 1500),
  }));
  const response = await claude.ask(
    `Page title: "${title}"\nPage text: "${text}"\n` +
    `Is this a job application form or a security/verification challenge? ` +
    `Reply with one word: "form" or "verification".`
  );
  return response.includes('verification') ? 'verification' : 'form';
}
```

检测到验证时暂停，提示用户手动处理后继续：

```
[wolf] 检测到验证或登录页面，请手动处理后按回车继续...
```

### 6. 分页截图

长页面按视窗高度自动拆分为多张截图，避免生成超大文件：

```typescript
async function screenshotPaged(page, basePath): Promise<string[]> {
  const vh = page.viewportSize()?.height ?? 800;
  const total = await page.evaluate(() => document.body.scrollHeight);
  const count = Math.ceil(total / vh);
  const paths: string[] = [];

  for (let i = 0; i < count; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vh);
    await page.waitForTimeout(150);
    const path = basePath.replace('.png', `-${i + 1}of${count}.png`);
    await page.screenshot({ path });
    paths.push(path);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return paths;
}
// 输出：screenshot-1of3.png, screenshot-2of3.png, screenshot-3of3.png
```

---

## 平台兼容性

| 平台 | 当前可用 | 主要挑战 |
|---|---|---|
| 自定义 mock 表单 | ✅ | — |
| Greenhouse | ✅ 理论可用 | 需测试 locator fallback |
| Lever | ✅ 理论可用 | React 事件，fill() 可处理 |
| Workday | ⚠️ 需适配 | Shadow DOM，自定义 web component |
| LinkedIn Easy Apply | ⚠️ 需适配 | 多步骤，速率限制 |

---

## 运行方式（POC）

```bash
# 1. 确保 Playwriter 插件已安装并点击激活
# 2. 启动本地表单服务
npx serve poc/filling/ -p 3333

# 3. 运行填表脚本
npx tsx poc/filling/fill-playwriter.ts http://localhost:3333/mock-form.html
```
