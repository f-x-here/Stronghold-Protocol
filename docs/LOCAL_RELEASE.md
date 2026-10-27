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
