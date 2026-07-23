# Happy Travel 测试与 CI/CD 平台设计

日期：2026-07-21

## 1. 背景与目标

`GeoLibra/happy-travel` 是公开 GitHub 仓库，已连接个人 Vercel Hobby 项目。Vercel Git Integration 已能为功能分支生成 Preview Deployment，并在 `main` 更新时生成 Production Deployment。仓库已有覆盖 F1 时序、模型、轮组、气流、影棚、反射、交互、资源和 i18n 的独立 `check:*` 脚本，但尚无统一测试框架、Playwright Test 配置、GitHub Actions 工作流、影响范围判定或内存泄漏门禁。

本设计建立一套可持续复用的测试、CI 和 CD 平台，使开发者及 Codex 在新增功能时只补充与行为相关的测试，而不再重新规划执行器、浏览器矩阵、证据格式和部署流程。

目标：

- 新增单元测试和浏览器测试通过目录规则自动发现。
- PR 必须通过质量门禁后才能合并 `main`。
- Vercel 继续原生负责 Preview 和 Production 部署，不在 GitHub Actions 中重复部署。
- 普通改动快速反馈，F1/WebGL 改动自动获得更完整的浏览器、资源和视觉验证。
- 下一页/行程页粒子与玫瑰彩蛋获得独立的行为、交互、视觉、资产和资源生命周期覆盖。
- Chromium、WebKit、桌面及移动模拟均有明确覆盖，并明确区分模拟测试和真机验收。
- 检测 JavaScript、React、DOM 和 WebGL 自有资源泄漏。
- 成功运行保持低日志和低存储；失败运行保留可诊断证据。
- 固化 Codex 的测试责任，降低重复规划、长日志分析和本地全量测试造成的时间与 token 成本。

## 2. 核心决策

### 2.1 GitHub Actions 负责质量，Vercel 负责部署

采用以下交付链路：

```text
功能分支 push
├── GitHub Actions：Fast Gate + Impact Browser Gate
└── Vercel：Preview Deployment

PR 检查全部通过
→ 合并 main
→ GitHub Actions：main 回归
→ Vercel：Production Deployment
```

不在 GitHub Actions 中调用 Vercel CLI，因此不需要 `VERCEL_TOKEN`、`VERCEL_ORG_ID` 或 `VERCEL_PROJECT_ID`。Production 的前置门禁由 GitHub `main` 分支保护保证：禁止直接 push，要求 PR 和指定 checks 通过。

### 2.2 直接迁移到 Vitest，不保留长期双轨

本次实施直接迁移所有适合单元/契约测试的现有 `check:*` 脚本到 Vitest，而不是只搭框架后延迟迁移。

迁移范围包括：

- F1 glitch sequence、welcome rAF controller、取消与干净帧边界。
- motion、wheel hold、airflow、studio、reflection、arrival motion。
- 交互分类、shake detection、rose animation、i18n。
- 粒子生成与更新、数量上限、resize/orientation 清理、帧率无关运动和资源 dispose。
- 可以通过纯 TypeScript、fixture 或文件契约稳定表达的行为。

粒子算法测试通过注入随机源或固定 seed 生成可复现数据；生产环境仍使用真实随机源。测试断言关注有限坐标、数量上限、运动边界、阶段转换和释放契约，不对随机像素逐点做脆弱比较。

迁移时不得机械复制所有源码正则：

- 能转为行为断言的规则改为行为测试。
- 确实属于架构边界的规则保留为少量 contract test，例如禁止自动序列使用 `setTimeout`。
- 已由行为测试覆盖、仅绑定实现文本的正则删除。

GLB 层级、mesh 所有权、资源大小、二进制文件、Blender 导出和媒体黑帧检查仍属于专用验证器，不强行包装成 Vitest 单元测试。它们由一个 manifest 驱动的统一 asset validator runner 执行，避免继续暴露十几个零散 npm 入口。portable GLB 验证属于日常 Fast Gate；Blender 几何验证属于模型资产变更时的本地 deep gate，普通 CI 和没有 Blender 的环境不执行。

### 2.3 采用影响范围测试并安全回退

仓库维护 `ci/impact-map.json`。resolver 根据 Git diff 选择 suite，并输出选择依据。规则采用 first-match/合并语义；无法解析、文件列表被截断、配置损坏或没有规则命中的情况必须 fail open 到全量测试，不能静默跳过。

resolver 自身必须有 Vitest 覆盖，并在 Fast Gate 中始终执行。

## 3. 测试分层

### 3.1 Fast Gate

每个 PR 和 `main` push 必跑，目标 2–4 分钟：

- Vitest unit/contract tests。
- portable 专用资产验证器（不依赖 Blender）。
- TypeScript `tsc --noEmit`。
- Production build。
- impact resolver 自测与摘要。

稳定入口：

```bash
npm run test:unit
npm run test:assets
npm run test:fast
npm run test:impact
npm run test:full
```

使用 Playwright Test 运行真实浏览器交互。当前配置由 `playwright.config.ts` 配合 `npm run dev` 启动 Vite dev server，保证验收轻量与热重载诊断能力；若需要针对打包后静态产物验收，可指定 `APP_URL` 切换为 `vite preview`。

为了保证 WebGL / Canvas 渲染与 Dev Server 物理隔离与确定性，单个 Worker 内部使用 `fullyParallel: false` 和 `workers: 1`；并发能力由 GitHub Actions Matrix Job 分发到独立 Runner 物理并行实现。

项目矩阵（实际配置与当前测试框架一致）：

| Project | 浏览器内核 | 配置 | 定位 |
| --- | --- | --- | --- |
| `app-desktop-chromium` | Chromium | 1280×800 | 桌面主 App 无残留 overlay 门禁 |
| `showroom-desktop-chromium` | Chromium | 1280×800 | 桌面 WelcomePage、CTA 交互、到达帧与 Canvas |
| `showroom-mobile-chromium` | Chromium | Pixel 7 (390×844) | Mobile touch / Viewport 模拟 |
| `showroom-webkit-smoke` | WebKit | 1280×800 | Desktop Safari / WebKit 内核兼容 Smoke |

移动项目只代表 viewport、DPR、User-Agent、touch、coarse pointer 和浏览器内核模拟，不宣称真机覆盖。发布前仍需要至少一台 iPhone Safari 和一台 Android Chrome 真机检查 WebGL、GPU 驱动、内存、发热、安全区和后台恢复。

WebGL context loss/restore 探针只在 Chromium 执行；WebKit 项目负责 Safari 内核、CSS、触控、基础 WebGL 和关键交互兼容。

### 3.3 Visual and Memory Full Gate

通过 nightly、`workflow_dispatch` 和发布前手动运行触发，目标 10–20 分钟：

- 完整 F1 到达时间线。
- 4.5 秒全息、100ms 干净保持、1.8 秒三脉冲故障、后续干净 rAF、自动拆解。
- 桌面、移动模拟和 reduced-motion。
- 拆解、重组、地板净空、轮旁车身语义分组。
- 黑帧扫描。
- 多轮场景生命周期、资源趋势、WebGL context loss/restore。
- MemLab heap snapshot 和 retainer trace。
- 下一页粒子在进入、resize、横竖屏切换、reduced-motion 和离开后的视觉与生命周期。
- 玫瑰从触发、粒子聚合、模型交接、开花、展示到关闭的完整时间线。

## 4. Playwright 交互覆盖

E2E 必须发送可信浏览器输入，而不是直接修改 React 状态：

- 鼠标按住启动，中途松开并验证取消。
- 再次按住到 100%，验证全息开始。
- 故障前点击汽车并验证自动序列取消。
- 故障中点击汽车并验证故障停止及现有交互分类。
- 自动拆解完成后点击可见部件，验证真实 raycast 命中和重组。
- 点击汽车未覆盖的 CTA，验证前景 canvas pointer forwarding。
- 聚焦汽车后按 `Enter`，验证键盘重组。
- 移动项目使用 touch 输入完成启动和汽车命中。
- reduced-motion 下完成关键流程。
- 多轮拆解/重组和场景离开，用于资源生命周期测试。

下一页粒子与玫瑰交互覆盖：

- 进入下一页/行程页，验证粒子 canvas 可见、位于预期内容层级，且不拦截按钮、卡片和导航的点击或触控。
- 验证 `ParticleBackground` 与倒计时粒子在 resize、横竖屏切换、页面隐藏/恢复及 reduced-motion 下保持有限坐标、数量上限和稳定布局。
- 通过真实秘密点击序列打开玫瑰弹窗；在支持的浏览器项目中模拟 DeviceMotion 权限允许/拒绝及摇动阈值，验证备用入口与抑制重复触发。
- 验证玫瑰的粒子聚合、模型交接、花瓣开花和最终展示阶段按可观察 phase 顺序完成，不用固定时间休眠推断阶段。
- 验证关闭按钮、背景点击和 `Escape`（组件支持时），以及弹窗层级、焦点、页面滚动和重复打开/关闭行为。
- 至少在 Chromium Desktop、Chromium Mobile 和 WebKit Mobile 中执行关键玫瑰交互；WebKit 不支持的传感器 API 使用能力检测并验证明确降级路径。

普通控件使用 role 或 `data-testid`。WebGL 汽车通过 canvas 和测试目标区域的 bounding box 计算点击点，随后用 `aria-pressed`、阶段状态和 renderer audit 验证结果；不得把固定屏幕绝对坐标当作唯一命中依据。

## 5. E2E 稳定性纪律

以下规则同时写入测试政策和 `AGENTS.md`：

1. 禁止使用 `waitForTimeout`、`sleep` 作为业务同步手段。
2. 只等待可观察状态：locator、URL、ARIA、业务 phase、网络完成或 renderer audit。
3. 判断元素不存在前，先等待证明页面已完成目标渲染的正向 landmark。
4. 使用 Playwright web-first assertions，禁止同步 DOM read 后立即静态断言动态状态。
5. silent success 流程必须证明 busy/处理中状态出现过，再证明其消失。
6. CI 使用 `retries: 0`；失败必须修复，不能用重试掩盖 flaky。
7. 每个测试使用独立 browser context，不依赖执行顺序或其他测试留下的状态。
8. 普通 smoke project 可并行；WebGL 重项目先保持单 worker，后续根据 CI 计量再调整。
9. 测试步骤、选择的 suite、耗时和失败原因写入 GitHub Job Summary。

文章《E2E テストをユニットテスト並みの実行時間に》中的影响范围测试、状态等待、并发取消、数据独立和失败可诊断性作为本设计的主要实践来源；本项目不复制其付费 8-core larger runner 和 Supabase 专属基础设施。

## 6. 测试代码结构

```text
tests/
├── unit/
│   ├── ci/
│   ├── f1/
│   ├── i18n/
│   ├── particles/
│   └── rose/
├── e2e/
│   ├── fixtures/
│   ├── pages/
│   ├── f1/
│   ├── itinerary-particles/
│   ├── rose/
│   └── smoke/
└── memory/
    ├── renderer-lifecycle.spec.ts
    ├── particle-lifecycle.spec.ts
    ├── rose-lifecycle.spec.ts
    └── memlab/

ci/
└── impact-map.json

scripts/ci/
├── resolve-impact.mjs
├── run-asset-validators.mjs
├── run-impact-tests.mjs
├── run-memlab.mjs
└── write-summary.mjs
```

Playwright spec 通过 Page Object 使用稳定接口，例如：

```ts
await welcome.startEngine();
await welcome.waitForHologramComplete();
await welcome.waitForGlitchStart();
await welcome.waitForCleanRecovery();
await showroom.waitForExploded();
await showroom.reassembleByRayHit();
await itinerary.waitForParticleField();
await rose.openBySecretClicks();
await rose.waitForBloomComplete();
```

locator、点击策略和状态等待封装在 Page Object 中，spec 表达业务场景。

## 7. 内存与 WebGL 资源验证

### 7.1 Playwright 生命周期趋势

在 Chromium 中运行至少五轮：

```text
进入欢迎页 → 启动 → 故障 → 拆解 → 重组 → 离开场景 → 强制 GC
```

第一轮视为模型、纹理和 shader 预热；第二至第五轮不得出现持续单调增长。记录：

- JavaScript heap 趋势。
- DOM 节点、卸载 React 组件和事件监听器趋势。
- 活跃 rAF。
- WebGL context。
- `renderer.info.memory.geometries`、`textures` 和 `renderer.info.programs`。
- 自有 RenderTarget、glitch material、fullscreen geometry 的创建/销毁。

另外运行两组独立生命周期循环，防止 F1 的稳定结果掩盖其他 WebGL/Canvas 泄漏：

```text
进入下一页 → 粒子运行 → resize/orientation → 离开 → 强制 GC
打开玫瑰 → 聚合 → 开花 → 关闭 → 再次打开/关闭 → 强制 GC
```

粒子循环记录 canvas、活跃 rAF、事件监听器、粒子 buffer/geometry/material 和 React 卸载对象；玫瑰循环还记录 `RoseModal`、`ThreeRose`、模型 animation mixer、40,000 粒子 buffer、纹理和 WebGL program。卸载后自有 rAF、listener、geometry、material、texture 必须返回基线，共享 Three.js 缓存按预热后稳定判定。

### 7.2 Renderer Audit

测试模式向 canvas 暴露只读 snapshot，不允许测试直接修改 renderer。至少包含：

```ts
interface F1ResourceAuditSnapshot {
  activeAnimationFrames: number;
  activeRenderTargets: number;
  activeGlitchMaterials: number;
  activeFullscreenGeometries: number;
  contextLosses: number;
  contextRestores: number;
  modelSourcePrewarms: number;
  geometries: number;
  textures: number;
  programs: number;
}
```

自有资源要求 create/dispose 配对并在卸载后归零；Three.js 共享缓存要求预热后稳定，不强制错误地归零。

该接口实施时扩展为场景无关的 `WebGLResourceAuditSnapshot`，通过 `sceneId` 区分 `f1-welcome`、`itinerary-particles` 和 `rose`，避免为每个页面重新发明测试探针。2D Canvas 粒子另外暴露只读的粒子数、活跃 rAF 和监听器计数。

### 7.3 MemLab

MemLab 只在 nightly 和手动 workflow 运行，覆盖：

- Welcome 生命周期：完整动画后离开欢迎场景。
- Showroom 交互：多轮拆解/重组和故障取消后恢复基线。
- 下一页粒子：重复进入/离开及 resize/orientation 后不保留 canvas、rAF 或监听器。
- 玫瑰生命周期：重复打开、完整开花、关闭后不保留 modal DOM、React Fiber、动画闭包或 Three.js 对象。

检测 detached DOM、unmounted React Fiber、闭包、事件监听器和仍由 JS 引用的 Three.js 对象。MemLab 不作为 GPU 显存的唯一证据。

### 7.4 Spector.js

Spector.js 作为开发和失败诊断工具写入文档，不作为日常 CI 硬依赖。它用于捕获异常帧、draw calls、shader/program、texture、buffer 和 framebuffer 状态；资源泄漏门禁仍由 renderer audit、趋势测试和 MemLab 组合完成。

## 8. GitHub Actions

### 8.1 `ci-fast.yml`

触发：`pull_request`、`push` 到 `main`、`workflow_dispatch`。

步骤：checkout、Node 版本固定、npm cache、`npm ci`、`test:fast`、build、摘要。使用标准 `ubuntu-latest`，最小 `contents: read` 权限和明确 `timeout-minutes`。

### 8.2 `ci-browser.yml`

触发：PR、`main` 和手动。先运行 impact resolver，再按输出构建 browser project matrix。F1 或测试基础设施改动运行完整矩阵；普通改动只运行 smoke 所需项目；未知改动全量回退。

影响映射至少包含：

- `ParticleBackground`、倒计时粒子和粒子工具改动 → particle unit、下一页 E2E、移动/横竖屏和 particle lifecycle。
- `RoseModal`、`ThreeRose`、`rose-animation`、`shake-detection` 或玫瑰资产改动 → rose unit、rose asset、rose E2E、WebKit Mobile 和 rose lifecycle。
- 共享 Three.js、canvas、路由或资源审计改动 → F1、particle、rose 三个域全部执行。

### 8.3 `ci-visual-memory.yml`

触发：nightly schedule 和 `workflow_dispatch`。运行完整视觉、黑帧、WebGL 生命周期、资源趋势和 MemLab。允许按输入选择只运行 visual、memory 或全部。

所有 workflow 使用：

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

CI 执行统一采用 Playwright 官方 Container 镜像（`mcr.microsoft.com/playwright:v1.61.1-jammy`，配置 `--ipc=host`）：

- 镜像预装对应版本的 Chromium、WebKit 浏览器二进制及 Linux 系统原生依赖库，工作流无需再进行浏览器二次下载或路径缓存。
- `package.json` 中的 `playwright` 依赖版本严格锁定为 `"1.61.1"`，保证 Node 驱动端与容器预装浏览器版本 100% 契约匹配。
- 项目 `npm` 依赖依然配置 `actions/setup-node@v4` 的 `cache: npm` 缓存 `~/.npm`，并配合 `npm ci` 安装。

不得使用付费 larger runner；并行度依据标准 runner 的实际计量调整。

## 9. 证据与日志策略

成功时仅保留短摘要、结构化 JSON、耗时、project 和 impact 选择依据。失败时上传：

- Playwright trace。
- 截图、视频和 console log。
- 下一页粒子与玫瑰完整阶段截图/关键帧证据；失败时保留聚合、交接、开花或 resize 前后的对应帧。
- renderer audit JSON。
- 黑帧扫描日志。
- MemLab `leaks.txt`、retainer trace 和必要 heap snapshot。

失败 artifact 默认保留 3 天，nightly 摘要保留 7 天。媒体、trace、heap snapshot 和浏览器缓存不得进入 Git。测试 reporter 默认简洁；Codex 只读取失败 job 的结构化摘要和相关 artifact。

## 10. CD 与 Vercel

Vercel 继续通过 Git Integration 自动部署：功能分支生成 Preview，`main` 生成 Production。仓库增加 SPA rewrite：

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

真实生产环境变量继续由 Vercel 管理。公开 GitHub Actions 不保存生产 `GEMINI_API_KEY`；CI build 使用不具备生产权限的占位值或在代码允许时省略。

## 11. 分支保护与发布门禁

GitHub `main` 规则要求：

- 必须通过 PR 合并。
- 必须通过指定 status checks。
- 合并前分支必须更新到最新 `main`。
- 禁止 force push 和删除。
- 禁止未经门禁的直接 push。

首批 required checks：Fast Gate、Impact Resolver、Chromium Desktop、WebKit Desktop。移动模拟项目先运行并观察稳定性，稳定后升级为 required。夜间 visual/memory 不阻塞普通 PR，但发布前必须有最近成功记录。

## 12. 依赖与供应链

增加 Dependabot 每周更新 npm 和 GitHub Actions。`npm ci` 使用 lockfile。安全扫描输出高危和严重漏洞摘要，但本任务不执行自动、可能破坏兼容性的 `npm audit fix --force`。当前基线存在 13 个审计结果（2 low、5 moderate、5 high、1 critical），需要在独立依赖治理任务中逐项确认直接/传递依赖、运行时可达性和升级影响。

## 13. 项目级 Codex 契约

根 `AGENTS.md` 增加简短强制规则：

- 每个行为变化必须增加或更新确定性测试。
- unit、e2e、memory 测试放入约定目录并可被自动发现。
- 生产路径变化必须更新 impact map；未知映射全量回退。
- 浏览器测试禁止固定 sleep，必须等待可观察状态。
- 提交前运行 `npm run test:impact`。
- F1/WebGL 变化必须包含 Chromium、WebKit 和资源生命周期覆盖。
- 粒子或玫瑰变化必须更新相应 unit、真实交互、视觉/阶段和 lifecycle 测试；玫瑰 GLB/OBJ/Blender 变化必须运行专用资产验证器。
- 模型资产变化必须在有 Blender 的本地环境运行 `npm run test:assets:deep` 并保留结果；模型未变化时不重复运行 Blender，GitHub 标准 runner 只运行 portable `npm run test:assets`。
- 浏览器媒体只在失败时上传。

详细规则、示例、真机边界和故障调查流程写入 `docs/testing/ci-testing-policy.md`，避免让 `AGENTS.md` 过度膨胀。

## 14. 开发者与 Codex 工作流

```text
理解行为 → 编写/迁移测试 → 实现 → 更新 impact map
→ 本地 test:impact → 提交 → push → CI 全量门禁
→ 只分析失败摘要和 artifact → 修复 → 合并
```

新功能的业务断言无法预先生成，但测试发现、浏览器配置、Page Object、服务器启动、证据格式、资源审计、CI 入口和部署流程全部复用。机器运行时间本身不要求 Codex持续读取输出；简洁 reporter 和失败时证据可以降低 token 消耗。

## 15. 预计耗时

| 阶段 | 目标耗时 |
| --- | ---: |
| 本地影响范围 | 1–3 分钟 |
| Fast Gate | 2–4 分钟 |
| Browser Impact Gate | 4–8 分钟 |
| `main` 回归 | 6–10 分钟 |
| Nightly visual + memory | 10–20 分钟 |

仓库公开，标准 GitHub-hosted runner 可免费使用；仍通过 impact selection、并发取消、失败才上传媒体和低频 MemLab 控制资源。

## 16. 验收标准

- 适合的现有 `check:*` 已直接迁入 Vitest，旧入口被统一命令替代。
- 专用资产验证器由一个 manifest runner 执行，portable 与本地 Blender deep gate 明确分层。
- 新 unit/e2e/memory 测试无需编辑 workflow 即可发现。
- PR 自动运行 Fast Gate 和安全回退的 Browser Impact Gate。
- Chromium/WebKit 和桌面/移动模拟均覆盖真实点击、触控、键盘和 F1 pointer forwarding。
- F1 干净 rAF、context loss/restore 和资源释放有自动化验证。
- 下一页粒子的进入/离开、交互穿透、resize、横竖屏、reduced-motion、数量上限和资源释放有自动化验证。
- 玫瑰的秘密点击/摇动降级、弹窗交互、粒子聚合、模型交接、开花时间线、资产契约和重复开关资源释放有自动化验证。
- MemLab 可通过 nightly/手动运行，Spector.js 有诊断文档但不成为日常依赖。
- 成功输出简洁，失败具有 trace、截图、视频、console、renderer audit 和内存证据。
- GitHub `main` 受 PR/status checks 保护。
- Vercel Preview/Production 保持原生自动部署，不需要 Vercel secrets。
- 测试媒体、heap snapshot 和大型证据不进入 Git 历史。
