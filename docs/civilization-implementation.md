# 文明的存续实现交付

已实现凯尔希策略「文明的存续」及独立棋子「存续·Mon3tr」。出售任意来源的精锐状态干员，按基础商店等阶首次记录普通版特质；五阶及以上发放一次，支持后续追加。遗产存在对局策略状态中，不是装备，不占物品栏或装备栏。铃兰普通／精锐均可重触发获得时效果；其他特质复用原触发器，以策略 Mon3tr 为主体，由存续在场条件门控。

专属 Mon3tr 固定 S3、调和／协防干员／存续，使用既有干员和重构体数据、技能及资源。普通自选池及 backups.json 未修改。没有新增磁盘存档系统，现有内存对局与断线重连保留状态。

## 验证

- 本功能 14 项测试通过，包含满手溢出、两份获得时效果独立初始化、铃兰重触发、后续刷新、出售事件、真实重构体与 S3 施放。
- 相关完整回归：319 通过、5 跳过、0 失败；另组插件／房间／进程兼容：113 通过、0 失败。
- Golden：49 roster、48 bonds、22 fields、21 matches、10 standins、140 diy，共 290 场景已核对；最后仅修正新增存续的两个场景并复验整个 bonds。快速 golden 测试 9 项通过。
- Typecheck 通过。全仓 lint 为 0 error、149 warning。i18n 四个语言包均 0 missing、0 error。git diff --check 通过。
- 浏览器确认策略、独立名称、S3 配置及图标正确加载，页面异常为 0；此检查是资源与图标 UI 烟测，不是完整浏览器对局验证。
- 本地服务已启动：http://localhost:3000，healthz 正常。

## 验证边界

全量仓库测试未全绿。迭代中的一次全量执行为 10478 项：10155 通过、241 失败、79 跳过；其中包含当时尚未修复的本任务兼容问题以及 Windows EPERM／符号链接权限、缺失资源等问题。修复后已重跑上述相关子集，没有再次运行整套全量测试，因此不能把该旧轮失败数当作最终失败数，也不声称全量通过。

完整官方数据构建缺少 .cache/gamedata/excel/activity_table.json，离线重建未完成；本次使用 tools/build-civilization.mjs 从现有生成数据重建新增内容，并通过数据引用、组合及运行测试。导入边界检查仍报告未修改的 server/sim/nodeData.js 三处 Node 模块导入。

## 图标

[本地图标](../public/assets/bond/survivalShip.png) 使用用户提供的主体，经内置 imagegen 合成为白色主体、绿色圆底、透明外沿。[制作说明与完整提示](civilization-icon.md)。按仓库资源规则，图像位于忽略的 public/assets 中，不进入 git；复制或打包游戏时须一并保留。

## 修改文件

- data/assets.json
- data/bands.json
- data/bonds.json
- data/chess.json
- data/effects.json
- docs/DATA.md
- docs/META.md
- docs/civilization-icon.md
- docs/design/match.md
- docs/history/0.3.3.md
- public/css/components.css
- public/css/screens/game-panels.css
- public/js/ui/assetUrls.js
- public/js/ui/detailPanel.js
- server/match/civilization.js
- server/match/effectsMeta.js
- server/match/fields.js
- server/match/gamedata.js
- server/match/player/basics.js
- server/match/player/economy.js
- server/match/player/round.js
- server/match/player/views.js
- server/match/preview.js
- server/sim/battle/players.js
- server/sim/content/bands/meta.js
- server/sim/content/garrisons/battle.js
- server/sim/content/garrisons/meta.js
- server/sim/simdata.js
- server/sim/snapshot.js
- shared/civilization.js
- shared/plugins/validate.js
- test/backups.test.js
- test/content/bands.test.js
- test/content/civilization.test.js
- test/data.test.js
- test/diy.test.js
- test/golden/bonds.json
- test/golden/fields.json
- test/golden/matches.json
- test/golden/roster.json
- test/match/civilization.test.js
- test/ui/assetUrls.test.js
- test/ui/band-draft-badges.test.js
- test/ui/feedback5-result-bonds.test.js
- test/versions-keying.test.js
- tools/assets/plan.mjs
- tools/build-civilization.mjs
- tools/build-data.mjs
- tools/civilization-data.mjs
