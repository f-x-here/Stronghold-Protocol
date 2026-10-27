# 20 人 + 无尽模式源码扩展

适配的上游：v0.3.3，`f07b8965`。这是用户明确要求的自定义玩法。

上游原生 content / script 插件不能注册房间协议、扩大座位或替换 Match 回合生命周期。因此本扩展采用**源码插件**形式：独立载荷、三方合并安装器和可逆卸载，核心接入改动都能从载荷重建；不冒充可在游戏插件面板勾选的普通插件。

当前工作目录已安装。启动根目录的 `启动20人无尽版.bat`，房间内选择 4 / 8 / 10 / 16 / 20 席（默认 8），再按需开启「无尽模式」。不开启无尽时保留普通战役结算。
工作区现分为 `code`（此 Git 仓库）与同级 `release`（带北京时间批次的程序包和素材包）。所有命令从 `code` 中执行，打包方式见 `docs/LOCAL_RELEASE.md`。

- 六人起使用固定分组卡池；20 人为五组四人，每组独立策略及六张机变轮选。
- 分组成员固定，死亡或离开不重分组。在线、未托管的玩家优先选择；联防最多五轮，可由在线手动玩家多数票跳过后续联防。
- 无尽保留阵容、经济和盟约层数。普通最终领袖及符合条件的隐藏领袖后，循环最后三个普通波次；每 15 个无尽回合再战领袖。
- 无尽第 n 回合，敌方生命乘 1 + 0.15n，攻击乘 1 + 0.08n；速度、数量与出怪时间保持原模板。
- 无尽开启时解除盟约禁用；每击败一次领袖，实际参战且存活的玩家增加一个真实部署位。
- 主动退出显示自己的权威战报并记录一次，队友继续。

## 安装、检查和卸载

需要 Node.js ≥22 和 Git。整个 `extensions/20p-endless` 文件夹可以复制到其他克隆目录。

```powershell
node extensions/20p-endless/manage.mjs status
node extensions/20p-endless/manage.mjs check
node extensions/20p-endless/manage.mjs install
node extensions/20p-endless/manage.mjs uninstall
```

也可以在外部调用 `node <扩展路径>/manage.mjs install --root <仓库目录>`。

安装及卸载先预检所有文件，再写入；同一操作可重复执行。遇到上游/本地冲突会列出文件并停止，不写冲突标记。修改前的文本备份在 `.cache/20p-endless/`。操作前停止该目录的服务，操作后重新启动并刷新浏览器。

## 跟随上游更新

推荐先保存自己的 Git 提交，在干净工作区卸载扩展，再更新上游，最后重新安装：

```powershell
node extensions/20p-endless/manage.mjs uninstall
git add shared server public test docs
git commit -m "暂时卸载 20 人无尽扩展以更新上游"
git fetch upstream
git merge upstream/master
node extensions/20p-endless/manage.mjs check
node extensions/20p-endless/manage.mjs install
```

`upstream` 指原作者仓库，`origin` 指你的 fork；若原作者默认分支变更，应使用实际分支名。安装器对新版使用三方文本合并；能干净合并不代表新版玩法已经验证。冲突需按新的调用链重新适配，不能强行覆盖。扩展载荷记录已验证基线，升级后必须重新验证。

维护者完成新版适配并审阅后，可重新生成载荷：

```powershell
node extensions/20p-endless/refresh.mjs --base <新版上游提交> --version 1.0.1
node --test test/source-extension.test.js
```

`refresh` 默认只更新载荷已有的文件；新增接入文件需显式加 `--add <相对路径>`。
它会把该上游提交作为卸载后的基线，不能把含扩展的提交误当作上游基线。

```powershell
node --test test/lobby-capacity.test.js test/lobby-endless.test.js test/match/endless.test.js test/match/player-capacity.test.js test/match/group-drafts.test.js test/match/group-stock.test.js test/match/group-unite-rounds.test.js test/ui/group-draft-views.test.js test/ui/group-drafts.test.js
npm run ci
npm run golden
node tools/i18n.mjs check --all --strict
```

不在扩展中包含官方美术。运行素材直接保存在 `public/assets/` 和 `public/fonts/`，均为独立目录并由 Git 忽略，不依赖旧版目录。旧版源码、旧资源包及历史构建目录已移入 Windows 回收站。


## 本地等待室与时装修复（2026-10-27，用户定制）

- 多人卡片以可滚动网格显示，邀请图标缩小；人数工具栏固定保留「添加 AI 队友」，小窗口无需在卡片内部寻找按钮。
- 等待室的每个其他在线玩家/AI 卡片提供「交换位置」。AI 自动接受；真人需对方确认，可取消，30 秒失效。
  服务端检查双方身份与原座位，离开、断线或开始比赛取消请求；交换整条座位记录，房主身份及个人设置随玩家保留。
  交换清除真人准备状态，开局后不允许交换。固定卡池分组由开局时座位决定，战斗规则不变。
- 从本机已有素材重建两个原生个人外观插件 `local-outfits-a/b`，不写生成的 `data/assets.json`，不在服务器提供下载/安装报文。
  当前资源有 273 套皮肤与 273 套 Front 模型（其中部分官方皮肤没有 Back，沿用 Front 回退）。
  新浏览器默认启用；已有偏好可在设置 → 外观插件启用两个插件，或在更换立绘面板按「启用本地时装」。
  更换立绘先选干员，再选外观；这与干员调配共享该干员的皮肤选择，会同步给队友并用于战场模型。
  返回/关闭不保存尚未确认的选择。素材缺失沿用上游默认外观回退。
- `node tools/local-outfits.mjs` 使用已有文件重建插件并生成经过校验的锁文件，无网络下载。目录表参考
  [xinhai-ai 的实现](https://github.com/xinhai-ai/Stronghold-Protocol/blob/3327c49/docs/research/08-skins.json)，
  运行时沿用当前 v0.3.3 的 charId 选择键及外观插件机制。每个插件低于原有 200 MiB 限制，不提高上游限制。
  `npm run package` / `package:lite` 自动重建并携带这两个特定插件，其他服务器私有插件仍排除；素材与官方美术不提交到 Git。


## 本地 20 人资源缓存修复（2026-10-27）

`public/js/assets.js` 的 `spineCachePolicy` 为支持设备能力查询的浏览器分档，保留有界的页面内模型缓存：

| 设备 | 模型数上限 | 闲置预算 | 离开场景后的保留预算 | 保护期 / 静默判定 |
|---|---:|---:|---:|---:|
| RAM ≥8 GiB 且线程 ≥8 | 240 | 192 MiB | 64 MiB | 120 秒 / 60 秒 |
| RAM ≥4 GiB；或内存未知且线程 ≥4 | 96 | 48 MiB | 16 MiB | 60 秒 / 30 秒 |
| 低内存或能力未知 | 60 | 48 MiB | 0 | 15 秒 / 3 秒 |

低内存设备和无浏览器环境保留上游限制。活跃引用不回收，正在卸载的模型必须等待卸载结束后才重新加载，沿用上游的安全约束。
超过上限、长时间闲置或页面销毁仍会回收；不承诺无限内存常驻。缓存键仍是实际资源 URL，因此原版、皮肤及内容更新不会串用。

房间预热已安装的棋盘，进入对局预热当前关卡；共享渲染器原有的加载 Promise，不创建渲染器、不批量拉取所有队友模型。
显式 2D、简化渲染、省流量模式及无 WebGL2 的设备跳过预热。内容哈希棋盘文件使用正常 HTTP 缓存；无哈希的可变文件保留重新验证。

断线后同一页面可复用仍在预算内的解析模型。刷新/重开页面会重新解析模型，但同一域名、相同资源 URL 的文件应命中浏览器 HTTP 缓存或已导入缓存，避免重传资源包。
浏览器清理/驱逐缓存、改用新域名或资源内容更新后仍需要重新获取相应文件。
