# 可移植 CSS 粘贴指南

> 交付物配套文档(渲染统一第 5 步,docs/渲染统一方案.md §8-5 / §9 目标 2)。
> 主题工场 → 导出菜单 → **可移植样式包(完整 CSS)**:theme-base.css 全文 +
> 当前主题令牌内联,选择器已改写为目标端内容容器——贴过去即复现 Themd 预览观感。
> 令牌缺失项走 theme-base 内置回落值(「极简」主题观感),与应用内行为一致。

## 产物说明

| 目标端 | 选择器 | 文件名 |
|---|---|---|
| Typora | `#write` | `<主题名>.typora.css` |
| VSCode Markdown 预览 | `.vscode-body` | `<主题名>.vscode.css` |
| GitHub | `.markdown-body` | `<主题名>.github.css` |
| 通用(自建 HTML 等) | `.themd-prose` | `<主题名>.portable.css` |

- 主题设了暗色套时,暗色令牌按 `prefers-color-scheme: dark` 自动切换。
- 画布背景(`app.bg`)单独落 `body` 块。
- 自定义字体依赖本机安装:目标机器没有该字体时按回落链呈现(打包字体
  JetBrains Mono / HarmonyOS Sans SC 不会随 CSS 携带)。

---

## Typora

**粘贴位置**(二选一):

1. **作为独立主题**:文件 → 偏好设置 → 外观 → 打开主题文件夹,
   把 `<主题名>.typora.css` 放进去 → 重启 Typora → 菜单「主题」选它。
   (文件名即菜单里显示的主题名)
2. **并入现有主题**:把文件内容整体追加到当前主题 css 末尾。

**粘贴验收清单**:

- [ ] 正文字体/字号/行高与 Themd 预览一致
- [ ] 六级标题字号梯度与颜色;一级/二级下边框(若主题设置)
- [ ] 加粗/斜体/删除线;自绘删除线(设置过「离文字距离/粗细」时验证位置与粗细)
- [ ] 行内代码底色/圆角;代码块底色/内边距/横向滚动(长行不折行)
- [ ] 无序/有序列表缩进与 marker 颜色;任务列表勾选框配色与已完成文字色
- [ ] 引用左边框;表格表头底色/斑马纹/悬停行背景
- [ ] 链接颜色与下划线策略(hover 才下划线的主题,悬停验证)
- [ ] 画布背景(`app.bg` 设置过时整页生效)

**已知边界**:Typora 无 GFM 提示块(alerts),`[!NOTE]` 语法以普通引用呈现;
数学公式走 Typora 自带渲染,主题只控制外围段落间距。

## VSCode(Markdown 预览)

**粘贴位置**:把 `<主题名>.vscode.css` 存到本机任意位置,`settings.json` 加:

```json
"markdown.styles": ["file:///C:/path/to/<主题名>.vscode.css"]
```

打开任意 `.md` 的预览(Ctrl+Shift+V)即生效。

**粘贴验收清单**:同 Typora 清单,另验证:

- [ ] 预览与 Themd 预览并排对比,标题/正文/代码块观感一致
- [ ] 代码高亮配色为 VSCode 自带(主题令牌控制底色/字号/字体,不控制语法配色)

**已知边界**:VSCode 预览无 GFM 提示块;`.vscode-body` 上 VSCode 自带样式
与导入 CSS 同特异性,后加载的导入样式胜出,个别元素(如表格边框)如观感
不对,在主题工场「附加 CSS」里加高特异性规则再导出。

## GitHub

**粘贴位置**:浏览器装 [Stylus](https://add0n.com/stylus.html) 扩展 →
新建样式 → 粘贴 `<主题名>.github.css` 全文 → 「应用到」填 `github.com` 域 → 保存。
打开任意 Markdown 渲染页(README/Issue/PR/评论预览)生效。

**粘贴验收清单**:同 Typora 清单,另验证:

- [ ] README 页与 Themd 预览并排对比观感一致
- [ ] GFM 提示块五类配色/左边框生效(GitHub 原生支持 alerts)
- [ ] 任务列表勾选框配色(GitHub 渲染 `input.task-list-item-checkbox`,命中同一选择器)

**已知边界**:GitHub 页面自身有工具链类名(`.markdown-body` 内的布局类),
个别容器宽度/对齐由 GitHub 布局接管;数学公式为 GitHub 自带渲染。

## 通用(自建 HTML)

**粘贴位置**:页面 `<head>` 内 `<style>` 或外链。正文容器加 `class="themd-prose"`
(或把 CSS 里 `.themd-prose` 批量替换成你的容器选择器),容器内放标准
CommonMark/GFM 渲染产物。

**粘贴验收清单**:与 Typora 清单相同;建议直接用 Themd「导出 HTML」的产物
做对照——它内嵌同一份 theme-base.css,观感应逐元素一致。
