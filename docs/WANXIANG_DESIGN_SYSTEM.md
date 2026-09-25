# 万象图鉴 V1 — Tactical Codex Design System

> 状态：V1 基线。新增页面和功能默认遵守本文件，除非有明确的产品理由偏离。

## 1. 产品定位

万象图鉴不是游戏官网，也不是传统 Wiki。它是一套面向《王者万象棋》玩家的 **资料检索 + 构筑理解 + 版本追踪 + 实战决策** 工具。

设计目标按优先级排序：

1. 让玩家最快找到答案；
2. 让复杂关系比原始字段更容易理解；
3. 保持高信息密度但不制造视觉噪声；
4. 让新功能自然加入，不破坏既有体验；
5. 游戏感来自真实游戏对象，而不是装饰特效。

## 2. 设计气质

**Tactical / Editorial / Precise / Calm**

- 冷静：大面积中性色，强调色稀缺。
- 精密：规则网格、稳定间距、数字对齐、明确状态。
- 编辑感：依赖排版和信息次序形成层级，不依赖 Card Soup。
- 游戏感：头像、装备图标、品阶、阵营、站位、关系是主要视觉资产。
- 克制：不使用大面积渐变、玻璃拟态、霓虹外发光、无功能动画。

## 3. 信息架构

一级导航固定为：

- 首页
- 资料库
- 阵容
- 版本
- 工具

资料库二级分类：英雄、棋手、装备、天赋、效果牌、机制、冷知识。

禁止把所有数据类型重新提升为一级导航。

### 首页任务

首页回答：我想查什么？当前是什么版本？我常用的入口在哪里？最近发生了什么变化？

首页不承担完整数据库展示。

### 详情页任务

详情页优先回答：
1. 它是什么；
2. 它最重要的效果是什么；
3. 它和哪些对象有关；
4. 当前版本是否改变过它；
5. 最后才是完整字段。

## 4. 响应式导航

### Desktop ≥ 960px
- 左侧轻量 Sidebar，宽 216–232px。
- Global Search 固定在主内容顶部。
- 主内容最大阅读宽度约 1440px。
- 一级导航常驻；资料库子导航进入资料页后展示。

### Mobile < 960px
- 不使用大抽屉作为主要导航。
- 顶部：当前页标题 + Search。
- 底部：首页 / 资料 / 阵容 / 更多 四项导航。
- 筛选使用 bottom sheet / inline collapsible surface。
- 详情以全屏纵向页或 sheet 呈现。
- 触控目标最小 44px。

## 5. Color Tokens

### Dark
- bg: #0B0D10
- surface-1: #101318
- surface-2: #151920
- surface-3: #1B2028
- border: #252A32
- text-primary: #F2F3F5
- text-secondary: #B1B5BC
- text-tertiary: #7A818B
- accent: #C6A664
- positive: #64A887
- negative: #C66F6A

### Light
使用同样的语义层，而不是重新命名颜色。

### 阵营颜色
阵营颜色只作为数据语义：河洛 warm gold；逐鹿 muted red；日落海 cool blue；三分之地 jade green；大河流域 cyan blue；无阵营 neutral gray。

允许：小点、边缘、图表、关系线、微型标签。禁止：大面积背景染色。

## 6. Typography

系统 Sans 优先：Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif

字号级别：
- display: 32/38
- page-title: 24/30
- section: 18/24
- title: 15/22
- body: 14/21
- dense: 13/19
- meta: 12/17
- micro: 11/16

数字使用 tabular-nums。V1 产品内部不使用大面积宋体标题。

## 7. Spacing

唯一基础间距：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64。
页面布局优先靠 spacing、alignment、divider 分组。

## 8. Radius / Shadow

圆角：button 6px；input 8px；popover 10px；dialog 12px。
普通内容块尽量不使用 Card。
Shadow 只允许 command palette、dropdown、dialog、mobile sheet。

## 9. 核心组件

### Global Search
- 全站最重要的输入入口。
- / 或 Ctrl/Cmd + K 打开。
- 搜索结果按类型分组。
- 支持英雄、装备、天赋、阵容、机制和版本内容。
- 后续扩展为关系搜索，而不是单纯 substring search。

### Compact Record Row
- 真实图像 / fallback glyph
- 名称
- 关键效果
- 2–4 个语义标签
- 品阶或状态
- 整行可点击

### Atlas Grid
仅作为主动切换的图鉴模式。图像是主体，不叠加大量 badge。

### Detail Surface
结构固定：identity → primary effect → skills / core data → relationships → version context → technical data（折叠）。

### Version Change Row
版本改动优先使用 before → after，而不是卡片。

### Composition Preview
阵容列表应体现：核心英雄、阵营、成型期、站位微缩图、装备/天赋摘要。

## 10. Image Rules

- hero/player/equip/talent: 1:1
- 不使用装饰性 AI 图片代替游戏资产
- 图片失败必须有稳定 fallback
- 图片来源与数据来源分离配置
- 默认不把第三方版权资源复制进仓库；优先可配置远程源，后续再做合规缓存策略

## 11. Motion

只做反馈：hover 120ms；filter 120ms；panel 160ms；dialog 180–220ms。
禁止无限呼吸、背景粒子、装饰性漂移和大面积 parallax。
遵守 prefers-reduced-motion。

## 12. Content Principles

页面优先回答最常见的问题。

禁止：把 JSON 当正文；首屏展示维护人员指标；用“共 85 个英雄”替代真实任务入口；把所有信息等权展示。

推荐顺序：**答案 → 关系 → 解释 → 完整数据**

## 13. States

每个功能必须显式设计 loading、empty、no result、stale data、error、partial data、image missing。
错误必须告诉用户下一步可以做什么。

## 14. 扩展规则

新功能应进入既有一级导航语义：
- 构筑相关 → 阵容
- 数据对象 → 资料库
- patch/diff → 版本
- 计算器/识图/模拟 → 工具

禁止为了新功能新增无穷一级入口。

## 15. V1 验收

一个页面只有在以下条件同时满足时才进入 main：
- 360px 手机可用；
- 768px 平板可用；
- 1440px 桌面可用；
- 键盘可操作；
- 无明显横向滚动；
- 没有死路；
- 真实数据下仍保持层级；
- 断图时不崩；
- JS syntax + catalog validation 通过。
