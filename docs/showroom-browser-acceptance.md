# Showroom Browser Acceptance

Task 12 的浏览器验收脚本用于给 showroom scaffold 留下可复用证据，而不是每次手工从零规划。

## 本地运行

```bash
npm run check:showroom-acceptance
```

脚本默认检查 `http://127.0.0.1:3000`。如果该地址没有现成服务，它会启动本地 Vite dev server，并在结束时关闭。

也可以复用已有服务：

```bash
APP_URL=http://127.0.0.1:5173 npm run check:showroom-acceptance
```

## 覆盖范围

- 默认 `/` 路径不显示 `[data-showroom-overlay="true"]`，保留现有 F1 welcome CTA 和 canvas。
- `/?showroom=v2` 显示 showroom overlay、ignition、skip 控件。
- 桌面 viewport 下验证键盘 Space hold-to-start：按住到 `aria-valuenow >= 35` 后释放，进入 completing / handoff。
- skip 控件可点击，并能进入主应用。
- ignition ready/holding 阶段锁滚动，完成或 skip 后解锁。
- 移动端覆盖使用 Chromium mobile viewport emulation（390×844、touch、isMobile），不是物理手机，也不是真实 Safari/WebKit。

## 证据输出

脚本会写入 `output/playwright/`：

- `showroom-acceptance-summary.json`
- 默认页、showroom overlay、ignition progress、handoff、mobile overlay 的截图

`output/` 已在 `.gitignore` 中，不提交截图大文件；CI 可以把它作为 artifact 上传。

## CI 建议

Hobby / 免费额度下建议把该脚本放到 PR 或 main push 的可选/分层 gate：

1. 每次 push 跑轻量脚本：`lint`、纯逻辑 `check:*`、`build`。
2. showroom/F1 相关文件变更时跑 `check:showroom-acceptance`。
3. WebKit、真实移动设备、Blender 模型验收保留为手动或 nightly；模型未变更时不在 CI 每次跑 Blender。
