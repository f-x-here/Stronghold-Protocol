# 本地目录与成对打包

工作区布局：

```text
D:\gameproject\strong-protocol\
  code\       Git 仓库、开发依赖、运行素材和开发缓存
  release\    已打出的包，按北京时间批次分目录保留
```

在 `code` 中启动和打包：

```powershell
npm start
npm run package
```

`npm run package` 生成完整程序包和对应的浏览器素材包。`npm run package:lite` 生成精简程序包和对应素材包；
`npm run package:assets` 仅生成素材包。直接运行 `node tools/package.mjs` 也使用相同的本地批次入口。
有尚未提交的改动时默认拒绝，需先提交；明确用于测试时可加 `-- --allow-dirty`。

每次打包只取一次北京时间（Asia/Shanghai，精确到毫秒），例如：

```text
release/20261027-113000-123/
  Stronghold-Protocol-v0.3.3-20P-20261027-113000-123-full.zip
  Stronghold-Protocol-v0.3.3-20P-20261027-113000-123-assets.zip
  BUILD-INFO.json
  SHA256SUMS.txt
```

程序包和素材包的时间编号一致即属同一批次。程序包内部 `BUILD-INFO.json`、素材包内部 `README.txt`
都会注明打包时间、批次以及对应文件名。外部清单还记录源码提交、素材清单哈希、两个 ZIP 的 SHA-256 和状态。
只有 `status: complete` 的批次才全部完成；失败会留下 `failed` 清单，不能当作完整配对交付。
已有批次永不覆盖，阶段性拷贝目录在打包成功后自动清理。

`npm run package -- --dry-run` 只预检。`--out <目录>` 可显式更换产物根目录，但禁止输出到源码仓库或其父目录。
Windows 便携包脚本 `node scripts/make-windows-bundle.mjs` 也默认写入 `release/<批次>/`，并在包根写入打包时间。
该便携目录自带素材，不会将未生成的独立素材包写成已有产物。

源码扩展 ZIP 等单独交付物也放在 `release` 中，并保留其实际生成时间；旧包不留在源码缓存目录。


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

Windows 优先使用系统 bsdtar 处理长路径，每次压缩后核对 ZIP 文件名清单与待打包清单。压缩工具返回成功但漏文件时也会拒绝该产物。
