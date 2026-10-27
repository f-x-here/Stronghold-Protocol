# 本次迁移与验证（2026-10-27）

仓库：`https://github.com/f-x-here/Stronghold-Protocol`，上游基线 `f07b8965`，应用版本 0.3.3。
本地工作分支 `feat/20p-endless-v0.3.3`；没有推送远端。

原 `C:\Users\31669\Desktop\摸鱼\20人卫戍-Update` 的文件已剪切到
`D:\gameproject\strong-protocol\20人卫戍-Update`，包括其 Git 状态、源码、插件、素材和产物。
得到用户授权后停止旧服务，并迁入最后两份占用日志。

用户随后要求清理旧版：将 34564 个素材文件和 7 个字体文件移到独立的 `public/assets/`、`public/fonts/`，
按数量和总字节核对一致，移除原目录联接后将旧版目录移入 Windows 回收站。新版不再依赖旧目录。
移除临时上游基线副本和移植中间文件；最终日志、截图和源码扩展包集中保存在 `.cache/20p-port/`。
清理后重新启动服务：健康检查正常，抽查头像、Spine 骨骼/图集和字体 CSS 均返回 200，Chrome 页面无 JavaScript 异常。
后续按用户要求将整个 Git 仓库迁到 `D:\gameproject\strong-protocol\code`；素材和依赖随仓库迁移，
服务改从 `code` 启动。分发产物统一放在同级 `release`，程序包与素材包共用一个北京时间批次编号。

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


## 2026-10-27 等待室与时装修复

- 真实 WebSocket：AI 即时交换、真人确认/拒绝、请求权限、过期身份、离房取消、准备重置、房主身份保留、开局禁止交换。
- 浏览器（Chrome）：2048×807、1280×720、800×600、667×375 固定添加 AI 入口均通过命中点击检查。
  真人与 AI 交换均实际操作；273 套外观已加载，名片选择经过 room.skins 同步，另一客户端收到并显示对应皮肤图片。
  一个实际皮肤 Front 模型通过生产 Spine 加载器解析并实例化（12 动画、84 槽位），无页面错误。
  不是对 273 套模型逐一进行战斗实测；现有自动化会校验全部插件文件、锁与 541 个 Front/Back 骨架。
- 两个原生外观插件 `check --strict` 均为 0 problems / 0 warnings，不修改原生插件大小限制。
- 回归日志：`.cache/20p-port/room-browser-result.json`、`room-skin-tests.log`、`room-package-tests.log`、`room-fix-tests.log`。

成品回读发现 Windows Info-ZIP 在长路径下静默漏文件：压缩命令返回 0，但部分模型不在 ZIP 中。已在 Windows 优先采用 bsdtar，并在每次压缩后按 ZIP 中央目录逐一核对全部文件；新增超过 260 字符的模型路径回归。未通过的批次不交付。

补充检查：`update-package` 的 ZIP 读取、UTF-8/ZIP64 与压缩器错误分支定向验证；其历史集成用例仍引用旧的无时间戳包名，整文件执行会在找不到旧路径时失败，不作为本次回归通过依据。


## 2026-10-27 资源缓存热修复（扩展 1.0.2）

- 156 项缓存、棋盘、FieldHost 与文档回归全部通过。新增模拟时钟测试覆盖 80 模型的 20 秒断线/切队保留及静默预算回收；低内存设备保留原有约束。
- `RENDER_E2E=1` + `CHROME_PATH` 运行 `test/render/cache-retention.browser.test.js`：真实 20 人、5 组房间进入准备期，普通与皮肤模型加载后切队、重连并等待 21 秒，仍复用相同解析对象，未重新请求骨架/图集；重挂渲染器仍为 engine。
  实际观战席在两个战斗场地往返，无重复干员模型请求，无页面错误。检查已绘制模型的纹理仍有效，不只检查网络请求。
- 原有 `test/render/reconnect.browser.test.js` 的 delayed=false 场景通过：实际对局关闭页面后重新打开、通过正常保存座位恢复入口回到场景，官方棋盘和模型可见。
- 额外 CDP 检查（`.cache/20p-port/cache-http-result.json`）：新页面重新解析 2 个普通模型与 1 个皮肤模型，9 个骨架/图集/贴图请求全部由缓存提供，资源正文传输 0 字节。
- 不保证浏览器清理缓存、改域名、素材更新或内存超预算后仍永远常驻；这些情况按新 URL / 实际预算重新获取。没有批量预下载所有 20 队的模型。
