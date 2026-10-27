# 本次迁移与验证（2026-10-27）

仓库：`https://github.com/f-x-here/Stronghold-Protocol`，上游基线 `f07b8965`，应用版本 0.3.3。
本地工作分支 `feat/20p-endless-v0.3.3`；没有推送远端。

原 `C:\Users\31669\Desktop\摸鱼\20人卫戍-Update` 的文件已剪切到
`D:\gameproject\strong-protocol\20人卫戍-Update`，包括其 Git 状态、源码、插件、素材和产物。
得到用户授权后停止旧服务，并迁入最后两份占用日志。原路径只剩被其他进程持有的空目录，未强行结束该进程。

## 通过的检查

- 容量、无尽、分组卡池/轮选、分组联防、分组 UI、原生插件交互奖励：156 项，0 失败。
- 外部 AI/advisor、原生皮肤、20 人领袖血池重缩放、客户端大结果交接：105 项，0 失败。
- 测试模式与无尽回放：60 项，0 失败；20 人并行计时的暂停/继续另有回归。
- 版本切换定向回归：24 项，0 失败。房间/界面广泛回归最初 790 项中的唯一 fixture 问题已修正，版本回归重跑通过。
- `npm run ci -- --only smoke,guards,lint,imports,typecheck`：all steps passed。
- `node tools/i18n.mjs check --all --strict`：四包均 2362/2362，0 missing / 0 errors。
- `npm run golden`：默认官方版本全部 288 场景一致。没有更新 golden 期望，也没有改生成数据表。
- 扩展安装器：重复安装、重复卸载、保留其他上游改动、任一文件冲突时全量拒写均通过。
- 真实 Chrome：20 席（1 人 + 19 AI）、5 个固定组、20 条轮选记录、无尽开关和主动退出权威战报；`pageErrors=[]`。
- 新版资源清单的全部路径存在；图集尺寸检查通过。用 add-only 补充缺失资源，并使用仓库的图集处理函数补齐新增图集尺寸。官方美术未进入 Git 或扩展包。

浏览器只验证上述流程，未声称有 20 个真人客户端进行了公网长时间压测。

## 全量套件的实际结果与限制

最后一次完整 `npm run ci -- --keep-going`：10452 tests / 10284 pass / 89 fail / 79 skipped。
该快照发生在资源补齐和最后的文字缩放修复之前；相关项目已定向复查。
setup、smoke、guards、lint、imports、typecheck 均通过；test 步骤没有全绿。

失败包含 Windows 无特权符号链接 EPERM、Forge/打包环境、Python 启动或版本、并发性能阈值、
旧可选模型的 PMA 元数据等。未修改的上游基线同机抽检（asset-index / forgeImport / setup-game-dir）
为 66 tests / 25 pass / 41 fail，复现了链接、Forge 和 Python 环境失败；不据此声称每个失败都是上游问题。
没有删除或跳过测试、放宽性能阈值，或把完整 CI 报成通过。

复用的旧可选本地 enemy/token 模型与 v0.3.3 元数据仍有 PMA 差异，相关模型校验不是全绿。
新增资源之外的历史资源保留；不把整份旧素材库宣称为逐项运行时验证通过。

完整日志和截图保留在根目录 `.cache/20p-port/`：
`ci-final.log`、`feature-final.log`、`compat-final.log`、`checks-final.log`、`golden-final.log`、
`endless-replay.log`、`baseline-env-final.log`、`asset-paths-final.log`、`browser-final.log`、`room20.png`、`draft20.png`。
