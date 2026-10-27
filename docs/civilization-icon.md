# 存续盟约图标

2026-10-27，按用户提供的主体图，以内置 imagegen 工具编辑合成。主体改为白色、缩小并居中，
背景参照本项目盟约 UI 的薄荷绿圆底，圆外透明。最终文件为 1254×1254 RGBA PNG，游戏按 UI 尺寸缩放显示。

本地文件：public/assets/bond/survivalShip.png。依照仓库资源规则，图像不进入 git；
tools/build-civilization.mjs 将现有本地图像接入生成的资源清单，完整资源包仍应携带该文件。
凯尔希头像继续复用项目已有资源。重建资源清单时，tools/assets/plan.mjs 优先本地图标，缺失则沿用调和占位。

最终生成提示：

```text
Edit/composite this exact supplied emblem into one polished, compact game covenant badge icon. Preserve the recognizable supplied emblem's outline, branching shapes and internal detail faithfully; do not invent a different emblem. Convert the red and grey emblem to clean solid WHITE with transparent negative spaces, and reduce it to occupy approximately 58 percent of the diameter of a circular green badge. Center it optically. Reconstruct a simple circular mint-green badge background inspired by this exact UI palette: subtle radial gradient, light mint #b6ffea near top center, main emerald mint #4ed8af, darker green #16906e along lower edge; thin subtle light rim and restrained inner shadow, no dramatic glow. A crisp round green disc, not a rectangle, not a hexagon. Transparent outside the round disc. White emblem with good padding inside, all recognizable parts fully contained. No text, no labels, no extra decorative elements. Deliver a single centered square RGBA icon asset, 1024x1024, with the circular badge taking 92 percent of the canvas width. Important: the supplied image is ONLY the interior emblem; recreate the green circular base yourself. It must read clearly at small UI sizes.
```
