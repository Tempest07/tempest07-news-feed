# Tempest07 News Feed

这是独立 News Feed 前端仓库，只包含静态网页。

它使用已经部署的新闻 API：

```text
https://tempest-news-api.weiqian-yu.workers.dev
```

当前页中的英文新闻会自动翻译标题和摘要第一句，并在中文标题下保留英文原题。

## Cloudflare Pages 设置

| 设置 | 内容 |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | 留空 |
| Build output directory | `.` |
| Root directory | 留空 |

提交到 GitHub 的 `main` 分支后，Cloudflare Pages 会自动更新网页。
