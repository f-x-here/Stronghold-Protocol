# 20 人 + 无尽模式源码扩展

适配的上游：v0.3.3，`f07b8965`。这是用户明确要求的自定义玩法。

上游原生 content / script 插件不能注册房间协议、扩大座位或替换 Match 回合生命周期。因此本扩展采用**源码插件**形式：独立载荷、三方合并安装器和可逆卸载，核心接入改动都能从载荷重建；不冒充可在游戏插件面板勾选的普通插件。

当前工作目录已安装。启动根目录的 `启动20人无尽版.bat`，房间内选择 4 / 8 / 10 / 16 / 20 席（默认 8），再按需开启「无尽模式」。不开启无尽时保留普通战役结算。

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

不在扩展中包含官方美术。当前安装的 `public/assets` 和 `public/fonts` 通过目录联接复用 `20人卫戍-Update/Stronghold-Protocol/public/` 内的资源，移动或删除该归档前需先迁移资源。旧目录保留其完整 Git 状态、插件、资源包、启动器与历史产物，已被根仓库忽略。
