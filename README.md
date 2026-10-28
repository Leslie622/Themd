# Themd

> the**MD** · 样式自设的 Markdown 笔记本——你的 markdown，你的主题。

本地 Markdown 笔记应用：左侧管理笔记，右侧**边写边渲染**，渲染成什么样由你说了算。

📋 **项目速览**（目录结构、数据流、定制点、坑位）：[docs/项目地图.md](docs/项目地图.md)

## 功能

- 📝 **实时预览**：CodeMirror 编辑 + markdown-it 渲染，输入防抖 150ms 刷新
- 🗂 **笔记管理**：新建 / 重命名 / 删除 / 搜索（标题 + 全文）
- 📥 **导入**：多选导入本地 `.md` 文件；📤 **导出**：单篇导出为 `.md`
- 🔀 **三种视图**：编辑 / 分屏（可拖动分割线）/ 纯预览
- 💾 **自动保存**：zustand + localStorage（key: `md-notebook`），刷新不丢
- 🎨 代码高亮（highlight.js，按需注册常用语言）、任务列表、linkify、表格

## 技术栈

Vite 7 · React 19 · TypeScript · Tailwind CSS v4 · **shadcn/ui**（Radix + Nova 预设，CLI 生成）
CodeMirror 6（编辑）· markdown-it（渲染）· zustand（状态/持久化）

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc 类型检查 + 产物构建
```

## 目录结构

```
src/
  components/
    ui/           # shadcn/ui 组件（CLI 生成，可用 npx shadcn add 继续添加）
    Sidebar.tsx   # 左侧：列表 / 搜索 / 导入 / 新建
    EditorPane.tsx   # CodeMirror 6 编辑器
    PreviewPane.tsx  # markdown-it 渲染预览
  lib/
    markdown.ts   # ⭐ markdown-it 实例 + 自定义渲染规则（renderer.rules）
    files.ts      # 导入 / 导出
    time.ts       # 相对时间
  store.ts        # 笔记数据（zustand + localStorage 持久化）
  App.tsx         # 布局 / 视图切换 / 重命名删除导出弹窗
```

## ⭐ 自定义渲染成「自己喜欢的 HTML」

入口在 `src/lib/markdown.ts`：

- 每种语法元素（标题 / 代码块 / 引用 / 图片…）都有一个 `renderer.rules` 函数可覆盖，文件里已给出三个示例（标题锚点 id 已启用；fence、image 为注释示例）
- 预览区排版由 Tailwind Typography（`prose` 类）控制，可在 `PreviewPane.tsx` 和 `src/index.css` 里覆写

## 添加更多 UI 组件

```bash
npx shadcn@latest add <组件名>   # 如 tabs、tooltip、command...
```

## 后续路线（按需）

- 暗色模式（主题 CSS 变量已就绪，加个开关切 `.dark` class 即可）
- KaTeX 数学公式、mermaid 图表、目录/锚点跳转（标题 id 已生成）
- 存储升级：IndexedDB（大笔记）→ File System Access API（直接读写本地文件夹）→ Tauri 桌面版

## 字体声明

本产品界面默认中文字体使用 [HarmonyOS Sans SC](https://developer.huawei.com/consumer/cn/design/harmonyos-font/)（华为鸿蒙黑体，Regular/Bold 两个字重，打包于 `public/fonts/`），依据《HarmonyOS Sans Fonts License Agreement》免费商用许可内嵌使用，许可文本见 `public/fonts/HarmonyOS_Sans_LICENSE.txt`。
