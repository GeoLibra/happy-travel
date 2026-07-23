# Showroom Browser Acceptance

Showroom 与 WelcomePage 浏览器验收脚本用于为 F1 welcome、Canvas 交互与 handoff 留下可复用证据，避免每次手工从零规划。

## 本地运行

```bash
npm run check:showroom-acceptance
```

脚本默认检查 `http://127.0.0.1:3000`。如果该地址没有现成服务，它会启动本地 Vite dev server (`npm run dev`)，并在测试结束时自动关闭。

也可以复用已有服务：

```bash
APP_URL=http://127.0.0.1:5173 npm run check:showroom-acceptance
```

## 覆盖范围与运行目标

- 默认 `/` 路径加载当前 WelcomePage、F1 CTA 和 car canvas。
- 浏览器验收覆盖桌面/移动模拟下的 WelcomePage、真实 CTA、Canvas 和当前交互状态。
- 桌面 viewport 下验证引擎启动流程、音效与手势触发、到 handoff 进入主应用状态。
- 移动端覆盖使用 Chromium mobile viewport emulation（Pixel 7、390×844、touch、isMobile），不是物理手机，也不是真实 Safari/WebKit。

## Playwright 项目矩阵与 Worker 策略

Playwright 配置 (`playwright.config.ts`) 包含 4 个验收 Project：

1. `app-desktop-chromium`: 验证桌面默认路由主 App 无残留 overlay 阻挡。
2. `showroom-desktop-chromium`: 验证桌面 WelcomePage、CTA 交互、到达帧与 Canvas 状态。
3. `showroom-mobile-chromium`: 验证移动端 Viewport 下触控与 CTA 响应。
4. `showroom-webkit-smoke`: 验证 Desktop Safari / WebKit 内核下的 Canvas 与基础渲染。

为了保证 WebGL、Canvas 和共享 Dev Server 的物理渲染稳定，`playwright.config.ts` 使用 `fullyParallel: false` 和 `workers: 1`。CI 中的并行执行通过 GitHub Actions Matrix Job 将不同 Playwright Project 分发给独立 Runner 完成。

## 证据输出

脚本会写入 `output/playwright/`：

- `showroom-acceptance-summary.json`
- 默认页、Welcome CTA、Progress、Handoff 及 Mobile Viewport 的图像证据
- 失败时的 Playwright trace、video 与 console log

`output/` 已在 `.gitignore` 中，不提交截图与视频大文件；CI 将其作为 GitHub Actions artifact 上传供 review。

## CI/CD 容器环境与依赖缓存

### 1. 官方 Docker Container（默认落地方案）
GitHub Actions 物理任务直接运行于 Playwright 官方镜像 `mcr.microsoft.com/playwright:v1.61.1-jammy` 中：

```yaml
container:
  image: mcr.microsoft.com/playwright:v1.61.1-jammy
  options: --ipc=host
```

该镜像预装了对应版本的 Chromium、WebKit 浏览器二进制及完整的 Linux 系统原生依赖库，因此工作流中无需再执行 `npx playwright install` 或配置浏览器级别的路径缓存。

### 2. npm 依赖缓存
容器环境仅包含浏览器与 OS 依赖，不包含项目 `node_modules`。通过 `actions/setup-node@v4` 的 `cache: 'npm'` 缓存 `~/.npm` 全局包下载目录，随后运行 `npm ci` 安装项目依赖：

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm

- name: Install dependencies
  run: npm ci
```

### 3. 版本严格锁定契约
为防止容器镜像内置浏览器与 Node.js 客户端驱动不匹配：
- `package.json` 中的 `playwright` 依赖版本严格锁定为固定版本（如 `"playwright": "1.61.1"`）。
- Docker 镜像标签严格保持 `v1.61.1-jammy` 一致。
