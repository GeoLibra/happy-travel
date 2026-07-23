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

## CI/CD 与缓存方案

### 1. 触发与影响范围检测 (`ci-browser`)
showroom / F1 / 依赖项修改时触发浏览器验收，普通文档修改跳过浏览器矩阵。

### 2. 缓存方案 A（当前 GitHub Actions 默认方案）
使用 `actions/cache@v4` 缓存 `~/.cache/ms-playwright` 浏览器二进制：

```yaml
- name: Get Playwright version
  id: playwright-version
  run: |
    echo "version=$(node -p "require('./node_modules/playwright/package.json').version")" \
      >> "$GITHUB_OUTPUT"

- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-${{ runner.arch }}-playwright-${{ steps.playwright-version.outputs.version }}-${{ hashFiles('package-lock.json') }}

- name: Install selected browser
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps "${{ matrix.browser }}"

- name: Install system dependencies
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps "${{ matrix.browser }}"
```

### 3. 缓存方案 B（高度固定环境备选方案）
对于 Nightly Visual / Memory 任务或需要强一致 WebGL / Linux 原生系统库的环境，可使用 Playwright 官方 Docker 镜像（如 `mcr.microsoft.com/playwright:v1.61.1-jammy`）。在 PR Fast Gate 中保留方案 A 以维持轻量与良好的 Artifact / Permission 调试体验。
