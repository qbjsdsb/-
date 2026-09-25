# Game Update Runbook

这份文档规定《王者万象棋》版本更新时，万象图鉴如何保持“知道自己是否最新”。

## 自动阶段

每天定时任务会：

1. 从公开结构化上游同步 data/catalog
2. 从 live 参考页探测英雄、棋手、装备、天赋、效果牌数量
3. 更新 manifest.expectedLiveCounts
4. 运行数据和关系 Gate
5. 有变化则 commit 到 main
6. Pages 自动重新部署

### 为什么 live 漂移不是 CI 失败

外部游戏可以先更新，本站数据随后核验。

如果 live 装备从 79 变成 80，而本站只有 79：
- expectedLiveCounts = 80
- verifiedCounts 仍为 79
- validator 输出 warning
- 首页和版本页显示“待同步”
- 自动任务仍可提交这个事实

这避免“外部一更新，维护任务反而因为红灯无法记录更新”。

## 人工核验阶段

发现漂移后：

1. 确认官方 / live 资料新增或删除的实体
2. 做实体差集，不凭记忆猜
3. 优先等待结构化上游更新
4. 若上游滞后但 live 详情已可靠：
   - 把核验内容写入 data/overrides.json
   - 记录 source
   - 记录 observedAt
5. 更新 manifest.verifiedCounts
6. 更新 patch 信息（如需要）
7. 运行：
   - python3 scripts/test_sync_probe_parser.py
   - python3 scripts/validate_data.py
   - node --check assets/app.js
8. PR → CI → merge → Pages

## Overrides 原则

overrides 是人工核验层，不是临时垃圾桶。

允许：
- 上游尚未收录的新实体
- 已确认的字段纠错
- 当前 Patch 的可靠补充

禁止：
- 猜测数值
- 无来源的攻略结论
- 为了让数量对齐而造空记录

当上游后来收录同 ID / name 时，override 会继续覆盖同一实体，不产生重复数量。

## Patch 更新

版本变更时至少更新：

- manifest.gameVersion
- manifest.gameVersionDate
- data/patches.json

若实体数发生变化，还要核对：
- expectedLiveCounts
- verifiedCounts
- overrides / catalog

## 图片

游戏图片由 manifest.assetBase 提供。

原则：
- 不把第三方整站素材批量复制到仓库
- 图片失败必须保留文字 fallback
- 若未来改为自有缓存，需要单独记录来源和版权策略

## 发布 Gate

任何版本更新不得跳过：
- merged count
- duplicate entity
- comp hero relation
- board hero id
- equip id
- talent id
- JS syntax
- probe parser tests

数据正确优先于“第一时间看起来更新了”。
