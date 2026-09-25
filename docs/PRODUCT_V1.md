# 万象图鉴 V1 — Product Architecture

## 核心用户任务

### 查
- 这个英雄/装备/天赋是什么？
- 某个关键词有哪些对象？
- 当前版本改了什么？

### 理解
- 这个英雄属于什么体系？
- 为什么这个阵容需要这些核心？
- 装备、天赋、棋手之间如何联动？

### 构筑
- 我已有这些英雄，往哪个方向走？
- 某阵容有哪些核心与灵活位？
- 站位和装备怎么配？

## V1 页面

### 首页
- 万象搜索
- 当前版本摘要
- 四个高频入口：英雄 / 阵容 / 装备 / 机制
- 六大阵营概览
- 最近改动

### 资料库
二级类型切换，统一搜索/筛选/图鉴视图。

### 阵容
默认展示 64 套阵容：核心、成型期、阵营、微缩站位、成员。后续接版本化评级和玩家数据。

### 版本
- 当前 patch
- Entity-level changes
- 历史版本
- 数据同步状态

### 工具
V1 放置稳定入口，后续逐步加入：阵容构筑器、关系检索、装备查询、版本 Diff、截图识别。

## Routing

静态 GitHub Pages 下采用 hash routing：
- #/home
- #/library/heroes
- #/library/equips
- #/comps
- #/version
- #/tools
- #/entity/heroes/<id>

保证刷新和直接链接不依赖服务器 rewrite。

## Data Boundary

UI 不直接绑定上游结构。
流程：catalog snapshot → normalizer → domain helpers → view models → UI。

人工修正层继续位于 data/overrides.json。
图像基础地址写入 manifest，避免散落在页面代码中。

## Roadmap after V1 shell

1. 关系索引：hero ↔ keyword ↔ equip ↔ talent ↔ comp
2. 阵容构筑器
3. 版本 Entity Diff
4. 图像缓存/合规策略
5. 搜索 ranking
6. 实战工具与截图识别
