# 华盛顿共享单车骑行节奏

大数据可视化作业 3。使用 UCI Bike Sharing 的逐小时记录，对比 2011–2012 年华盛顿特区 Capital Bikeshare 工作日和休息日的骑行量。

## 本地运行

解压到同一目录后，用 Chrome 或 Edge 打开 `index.html`。数据、样式和 D3 均在包内。运行时不需要联网、安装库、构建或配置 API 密钥。

## 演示步骤

1. 在默认视图观察工作日 08:00 与 17:00 的两个高点，同时对照休息日的午间高点。
2. 单击热力图周二 17:00 的格子，查看该星期和小时的具体数值，同时比对折线图上同一小时的两类日期。也可以从折线图单击一个小时来高亮热力图对应列。
3. 在骑行类型中切换到“临时用户”，观察两条曲线怎样变化。
4. 输入 `2012年 7月 晴天 临时用户`，然后应用查询。输入框支持指定的关键词，由规则解析。峰值摘要由前端计算。
5. 使用 Tab 进入图表，方向键移动，Enter 选中，Escape 取消。可展开逐小时数值表。

## 部署到 GitHub Pages

1. 新建一个有 Pages 权限的 GitHub 仓库。免费账号可使用公开仓库。
2. 将解压后 `index.html` 同级的**所有文件和目录**放在仓库根目录。保留 `data/`、`vendor/` 等目录结构。使用 Git 推送时，也一并提交 `.nojekyll`。
3. 在仓库 **Settings → Pages → Build and deployment** 下，将 Source 设为 **Deploy from a branch**，分支选 **main**，目录选 **/(root)**，单击 Save。
4. 发布完成后使用 Pages 设置页的实际链接，检查图表和筛选功能，再将该链接写入报告。

官方说明：[Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 文件与数据

- `index.html` 页面结构；`styles.css` 响应式布局和颜色；`app.js` 筛选、聚合及图表交互。
- `data/rides.js` 包含 17,379 条小时记录，列顺序为 yr、mnth、weekday、hr、workingday、weathersit、cnt、registered、casual。
- `scripts/prepare_data.py` 从 UCI 原始压缩包内的 `hour.csv` 提取所需列。复现命令为 `python scripts/prepare_data.py /path/to/hour.csv`。
- `vendor/` 随包提供 D3.js v7.9.0 与 ISC 许可文本。

Hadi Fanaee-T (2013), [Bike Sharing](https://archive.ics.uci.edu/dataset/275/bike-sharing-dataset), UCI Machine Learning Repository, DOI [10.24432/C5W894](https://doi.org/10.24432/C5W894)，数据许可 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。预处理仅提取字段和转换格式，统计按实际观测计算。
