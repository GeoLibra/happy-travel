# Happy Travel：OSM 城市生长体验设计与技术调研

> 状态：讨论总结 / 技术设计草案  
> 日期：2026-08-14  
> 目标项目：`/Users/hgis/myproject/happy-travel`

## 1. 背景与目标

本方案源于 Three.js 实验 **Vine Overgrowth** 的“结构逐渐被生命覆盖”体验，并结合本地项目 `race-condition` 的三维城市、路线联动和 Shader 技术，探索如何为 Happy Travel 增加一个具有叙事感的上海旅行入口。

目标不是在 Happy Travel 中复刻藤蔓本身，而是迁移其核心体验：**一个结构在用户面前逐步生长、苏醒并承载信息**。

在旅行场景中，更合适的叙事对象是城市：

1. 路线首先出现并向前生长；
2. 路线经过的道路被唤醒；
3. 周边建筑从地面升起并点亮；
4. 关键地标出现；
5. 行程节点和内容卡片逐步展开。

这可以用于欢迎页、行程总览、每日路线切换，也可以成为 Happy Travel 区别于普通地图产品的核心视觉记忆点。

## 2. 核心设计判断

### 2.1 不继续使用藤蔓作为主体

藤蔓适合表达个人成长、履历和时间积累；城市更适合 Happy Travel 的旅行、空间与路线语境。因此建议保留 Vine Overgrowth 的“生长机制”，但将承载结构替换为上海城市和交通网络。

可保留的藤蔓式体验包括：

- 沿路径传播的进度；
- 分段、错峰出现；
- 路径附近元素受影响；
- 从抽象形态逐渐显露具体内容；
- 镜头跟随生长前沿移动。

### 2.2 城市采用混合方案

建议采用：

```text
OSM 城市骨架
  + 程序化建筑拉升
  + 真实道路 GeoJSON
  + 精选上海地标 GLB
  + 路线驱动的 Shader 动效
```

不建议两个极端：

- **完全手工建模整座城市**：成本过高，难以覆盖真实路线；
- **浏览器运行时加载并拉升大范围原始 OSM**：解析、三角化、Draw Call 和内存压力不可控。

更合理的方式是离线获取、裁剪和清洗 OSM 数据，运行时加载适合渲染的分区数据或预生成几何。

## 3. `race-condition` 的实现结论

`race-condition` 确实包含一座三维 Las Vegas 城市，但其主场景不是纯 OSM 实时生成，而是混合实现。

### 3.1 主城市是预制 GLB

主场景加载：

```text
web/frontend/public/assets/models/Google_LasVegas_Export_v32.glb
```

加载和材质分配位于：

```text
web/frontend/src/app/viewport/scene/scene.ts
```

模型内已经区分普通建筑、窗户、道路、植被、摩天轮和特殊地标等 Mesh/Material。前端负责重新绑定 Shader 和动画状态。

这说明它的完成度主要来自：

- 经过整理的城市模型；
- 有语义的 Mesh 命名和材质分组；
- 定制 Shader；
- 镜头、灯光和后处理；
- 路线与城市材质联动。

不能简单地将其视觉质量归因于 OSM 拉升。

### 3.2 仓库已有 OSM / GeoJSON 解析基础

`web/frontend/src/app/map.ts` 包含：

- 经纬度转 Web Mercator；
- 地图中心计算和 Three.js 世界坐标归一化；
- Polygon 建筑轮廓解析；
- LineString 道路、步行道解析；
- `height`、`building:levels` 等建筑高度推算；
- 根据 `highway` 类型分配道路宽度；
- 地标点解析；
- 基础 RoadGraph 构建。

该模块适合作为 Happy Travel 的数据层参考，但仍需增加建筑三角化、挤出、合批、分区加载和异常数据处理。

### 3.3 路网拓扑算法可复用

`web/frontend/src/app/road-network.ts` 实现了：

- GeoJSON 道路转世界坐标 polyline；
- 道路端点吸附；
- 线段交叉检测；
- T 型路口识别；
- 在交叉点拆分道路；
- Node/Edge 图构建；
- 封路、车辆生成和交通灯模拟所需的数据结构。

其中两两线段检测适合小范围数据。上海大范围数据应在离线阶段处理，或增加网格索引/R-tree，避免接近 `O(n²)` 的运行时计算。

### 3.4 路线遮罩是最值得迁移的效果

`web/frontend/src/app/viewport/route/route.ts` 会把路线绘制到 `512 × 512 CanvasTexture`，再以世界空间 UV 将其传入地面、道路和建筑 Shader。

因此路线不只是一根发光管线，它可以同时影响：

- 道路流光；
- 地面局部发光；
- 路线附近建筑窗户；
- 建筑颜色和生长进度；
- 拥堵或封路区域。

建议将这一机制发展为 Happy Travel 的 **Route Influence Map**。路线纹理可以输出距离场或多级灰度，让建筑按离路线远近依次升起，而不是简单地亮/灭切换。

### 3.5 城市窗户扫场和镜头动画可复用

`scene.ts` 使用 `CatmullRomCurve3` 驱动开场镜头，并根据建筑的世界坐标排序，让窗户亮度阈值横扫城市。

在 Happy Travel 中可改造为：

- 从虹桥机场向市中心点亮；
- 从酒店沿路线点亮至上海国际赛车场；
- 按 Day 1 / Day 2 / Day 3 唤醒不同城市区域；
- 镜头跟随路线生长前沿移动。

### 3.6 可复用的 Shader 和后处理思路

相关模块包括：

- `height-fog-shader.ts`：高度雾、窗户纹理、路线局部增亮、方向光和阴影；
- `road-shader.ts`：道路动态纹理、拥堵遮罩、世界空间 UV；
- `postprocessing.ts`：SSAO、Depth Outline、Bloom、LUT、Vignette、FXAA。

建议保留技术结构，但不照搬 `race-condition` 的深灰赛博配色。

## 4. Happy Travel 的视觉方向

视觉决策优先参考：

```text
/Users/hgis/myproject/wiki/skills/wanderlust-viz-design
```

辅助参考：

- `halcyon-viz-design`：安静空间感、克制发光、玻璃层级；
- `threejs-3d`：Three.js 场景和交互基础；
- `amap-bindbindmap`：中国境内地图、路线和 POI 表现。

### 4.1 配色职责

| 角色 | 建议颜色 | 用途 |
|---|---:|---|
| 城市背景 | `#F8FAFC` | 冷白、通透画布 |
| 建筑主色 | `#FFFFFF` / `#E2E8F0` | 程序化建筑主体 |
| 主路线 | `#0080FF` | 方向、确定性、当前选择 |
| 行动节点 | `#FF7F00` | CTA、出发、关键行程节点 |
| 次级路线 | `#0EA5A8` | 步行、接驳或补充区域 |
| 主文字 | `#0F172A` | 标题和重要内容 |
| 次级文字 | `#475569` | 说明和标签 |
| 弱化城市 | `#CBD5E1` / `#94A3B8` | 未激活区域 |

颜色必须有稳定职责：蓝色表示方向，橙色表示行动。避免把所有建筑、按钮和路线都做成高饱和发光体。

### 4.2 字体

- 标题、章节、大数字：`Outfit` 600–700；
- 正文、按钮、筛选器、地图标签：`Work Sans` 500–600；
- 坐标、系统字段、时间戳：`IBM Plex Mono` 500。

字体应显式加载并提供系统字体回退，不假设运行环境已有对应字体。

### 4.3 UI 与三维场景的关系

- 三维城市是主叙事层；
- UI 负责解释、选择和确认，不遮挡城市主体；
- 玻璃效果只用于顶部导航、悬浮筛选和 tooltip；
- 行程卡片使用白色实体表面、轻边框和轻阴影；
- 主容器保持 20–24px 圆角和充足留白；
- 动效使用平滑引导，避免弹跳和过度弹簧感。

## 5. 推荐体验流程

### 5.1 欢迎阶段

1. 屏幕只显示低对比度城市地面和少量路网；
2. 镜头从高空进入上海；
3. 当前旅程主路线开始绘制；
4. 路线周围建筑分批升起；
5. 上海地标在背景中出现；
6. 酒店、赛场和交通枢纽依次点亮；
7. 行程 UI 淡入，进入可操作状态。

### 5.2 行程切换

选择某一天时：

- 其他日期的建筑和道路降低对比度；
- 当前路线重新生长；
- 相应 POI 出现；
- 镜头移动到覆盖该日行程的构图；
- 行程卡片与城市节点保持双向高亮。

### 5.3 交互原则

- 默认采用导演式镜头，完成后允许有限 OrbitControls；
- 点击行程卡片聚焦对应地点；
- 点击城市节点滚动/切换到对应行程项；
- 提供“跳过动画”和 `prefers-reduced-motion` 降级；
- 移动设备降低建筑范围、像素比和后处理强度。

## 6. 推荐技术架构

```text
OSM / GeoJSON 原始数据
        ↓ 离线裁剪、清洗、投影、补高度
City Build Pipeline
        ↓
建筑分区数据 / 合并几何 / 简化道路
        ↓
Three.js City Runtime
  ├─ BuildingLayer
  ├─ RoadLayer
  ├─ LandmarkLayer
  ├─ RouteInfluenceMap
  ├─ CityMaterial
  └─ CameraDirector
        ↑
React 行程状态与 itinerary 数据
```

### 6.1 离线处理阶段

- 裁剪到行程涉及的上海区域；
- 过滤无关 OSM 标签；
- 修复 Polygon 朝向、自交和重复点；
- 根据 `height`、`building:levels`、类型和区域生成高度；
- 重要建筑保留独立 ID，普通建筑按材质/分区合并；
- 道路拓扑和路线贴合尽量离线完成；
- 输出带版本号的静态资源。

### 6.2 运行时阶段

- 分区加载城市；
- 使用共享材质和合并 BufferGeometry 控制 Draw Call；
- 建筑顶点保留 `buildingId`、随机种子或生长延迟属性；
- 使用 Route Influence Map 驱动升起、点亮和颜色；
- 使用 Catmull-Rom 路径控制镜头；
- 只对关键对象启用阴影；
- 根据设备能力调整 SSAO、Bloom、像素比和可见范围。

## 7. 建筑生长算法建议

每栋建筑至少需要以下稳定参数：

```ts
type BuildingAnimationMeta = {
  routeDistance: number
  routeProgress: number
  randomDelay: number
  districtId: number
  importance: number
}
```

基础进度可以表示为：

```text
localProgress = smoothstep(
  routeProgress + randomDelay,
  routeProgress + randomDelay + duration,
  globalProgress
)
```

渲染时优先在 Vertex Shader 中改变高度，并从建筑底部生长，避免 React/JavaScript 每帧遍历所有建筑 Mesh。

可以叠加：

- 距路线越近越早出现；
- 地标比普通建筑稍晚出现，但持续时间更长；
- 建筑到位后窗户亮度延迟增加；
- 路线前沿附近产生轻微扫描光；
- 非当前日期区域保持低对比度，而不是完全消失。

## 8. 性能边界

首版应从有限区域开始，不追求整个上海全量加载。

建议重点监控：

- Draw Calls；
- 可见三角面数量；
- 静态资源体积；
- 首屏可交互时间；
- Shader 编译时间；
- 路线切换时的主线程耗时；
- 桌面与移动设备帧率。

推荐策略：

- 普通建筑按区域和材质合并；
- 重复设施使用 InstancedMesh；
- 地标单独加载；
- 使用 Meshopt/Draco 压缩静态 GLB；
- 限制 `devicePixelRatio`；
- 后处理按性能等级启用；
- 路线纹理复用，避免每帧创建 CanvasTexture；
- 预生成确定性的开场时间线，减少运行时随机差异。

## 9. 分阶段实施建议

### Phase 0：视觉验证

- 一小块程序化城市；
- 一条固定路线；
- 路线生长；
- 建筑沿路线升起；
- Wanderlust 明亮配色；
- 一段导演式镜头。

目标：先验证“上海城市被旅行路线唤醒”的视觉命题。

### Phase 1：真实行程接入

- 接入 Happy Travel 现有 itinerary；
- 三天路线切换；
- 酒店、赛车场、交通枢纽和核心 POI；
- 卡片与城市节点双向联动；
- 响应式与低动效模式。

### Phase 2：真实上海城市

- 建立 OSM 离线流水线；
- 分区资源与缓存；
- 高度补全；
- 重点地标 GLB 替换；
- 道路贴合和交通流光。

### Phase 3：氛围与生产优化

- 高度雾和窗户 Shader；
- SSAO、轻描边、轻 Bloom、LUT；
- 天气/时段变化；
- 性能分级和浏览器验收；
- 确定性回放或可复现的演示模式。

## 10. 当前建议与未决事项

### 已形成的建议

- Happy Travel 使用城市，而不是继续以藤蔓作为主对象；
- 城市以 OSM 骨架 + 程序化拉升 + 地标 GLB 的混合方式实现；
- 技术表现参考 `race-condition`，视觉语言参考 `wanderlust-viz-design`；
- 最优先验证路线影响城市的 Route Influence Map；
- 首版只覆盖与行程相关的上海区域。

### 尚未决定

- 城市体验放在现有欢迎页之后，还是替代部分 F1 showroom；
- 采用日间冷白城市、黄昏城市，还是允许时段切换；
- 首版精确覆盖的上海范围；
- 首批需要单独制作的地标清单；
- 建筑数据最终输出为自定义二进制、JSON，还是预生成 GLB；
- 是否需要真实路径规划，还是先使用 itinerary 中的固定路线；
- 是否将城市体验独立为一个路由，避免影响现有核心流程。

## 11. 推荐的下一步

在修改 Happy Travel 主流程前，先制作一个隔离的城市视觉原型，只回答三个问题：

1. OSM 白模在 Wanderlust 配色下是否具备足够辨识度；
2. 路线遮罩是否能自然驱动建筑生长和点亮；
3. 在目标设备上，合理城市范围能否稳定达到可接受帧率。

验证通过后，再决定它与现有 F1 showroom 和行程规划界面的整合方式。
