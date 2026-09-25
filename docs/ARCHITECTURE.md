# 万象图鉴：架构与维护约定

## 原则
1. **事实数据与界面解耦**：页面只读取 `data/manifest.json` 指向的数据集。
2. **自动同步与人工核验分离**：`data/catalog/` 可由工作流覆盖；人工修正永远写入 `data/overrides.json`。
3. **版本补丁单独建模**：当前版本与历史补丁写入 `data/patches.json`，不要把临时版本说明硬编码进页面。
4. **零后端依赖**：站点是纯静态文件，可直接由 GitHub Pages 托管。
5. **渐进扩展**：新功能优先新增模块和数据文件，不修改既有数据语义。

## 目录
- `index.html`：页面骨架，不承载业务数据。
- `assets/styles.css`：设计系统与响应式布局。
- `assets/app.js`：目录浏览、筛选、搜索、详情。
- `data/catalog/`：上游结构化快照，可自动更新。
- `data/overrides.json`：人工校验、补充和纠错。
- `data/patches.json`：版本更新摘要。
- `scripts/sync_data.py`：同步上游。
- `scripts/validate_data.py`：部署前数据校验。
- `.github/workflows/`：同步和部署自动化。

## 新功能如何加入
例如“阵容构筑器”：
- 新建 `features/builder.js` 和对应样式；
- 如需持久数据，新建 `data/builder-rules.json`；
- 通过 `manifest.json` 暴露数据；
- 不需要改英雄/装备原始 JSON，也不需要迁移后端。

以后加入版本 Diff、站位模拟、截图识别、对局助手，均沿用同样边界。
