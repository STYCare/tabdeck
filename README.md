# 清页 QingYe

一个受 [tab-out](https://github.com/zarazhangrui/tab-out) 启发、但按我自己的使用习惯重做的新标签页 Chrome 扩展。

**定位：** 打开新标签页时，直接看到当前所有网页标签的分组视图，快速跳转、关闭、去重，或者先丢进“稍后处理”。

## 当前 MVP 功能

- 接管 Chrome 新标签页
- 读取当前所有网页标签
- 按站点域名分组
- 点击已有标签直接跳转
- 关闭单个标签 / 整组标签
- 一键清理重复标签（相同 URL）
- 保存到“稍后处理”
- 所有数据只存在本地 `chrome.storage.local`

## 安装

1. 克隆仓库
2. 打开 Chrome，访问 `chrome://extensions`
3. 开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择 `extension/` 目录

## 项目结构

```text
qingye/
  extension/
    manifest.json
    background.js
    index.html
    app.js
    style.css
    icons/
```

## 隐私

不联网，不上传，不走后端。你的标签页数据只在本地浏览器里处理。

## Inspiration

Inspired by [zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out), but rebuilt with my own product direction, copywriting, and implementation.

## 接下来想做

- 会话保存 / 恢复
- 项目工作区分组
- 更聪明的重复标签保留策略
- 标签页使用统计

## License

MIT
