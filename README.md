# 万象图鉴

《王者万象棋》非官方资料库与实战工具站。

## 设计目标

- **精美但克制**：不做大面积渐变、卡片堆叠和宣传式文案，桌面端强调信息密度，移动端强调快速检索。
- **长期可维护**：界面、数据、版本补丁和人工修正彼此解耦。
- **持续更新**：公开结构化上游每天自动检查；变化写回 Git 历史并触发重新部署。
- **自然扩展**：阵容构筑器、版本 Diff、关系图、截图识别和对局助手可以作为独立功能模块加入。

## 架构

- `index.html`：页面骨架
- `assets/styles.css`：设计系统
- `assets/app.js`：目录浏览、搜索、筛选和详情
- `data/catalog/`：自动同步的上游数据快照
- `data/overrides.json`：人工核验修正，自动任务不会覆盖
- `data/patches.json`：版本更新记录
- `scripts/sync_data.py`：上游同步
- `scripts/validate_data.py`：数据和部署前校验
- `docs/ARCHITECTURE.md`：扩展与维护约定
- `.github/workflows/`：CI、数据同步与 GitHub Pages 发布

## 数据更新策略

自动同步只修改 `data/catalog/` 与同步元信息。游戏刚更新、上游尚未补齐时，把已核验的新记录放进 `data/overrides.json`；页面加载时会自动覆盖或补充基础快照。这样既能快速跟版本，又不会让自动任务覆盖人工校验。

## 部署

站点是零构建依赖的静态网站。GitHub Pages 设置为 **GitHub Actions** 后，`main` 每次更新都会运行数据校验并自动发布。

基础结构化资料注明来源于公开的万象棋谱 WXHub 数据集；版本补丁单独记录来源。本站与腾讯游戏无隶属关系。
