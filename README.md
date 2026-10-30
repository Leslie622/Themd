# Themd

Themd 是一个本地 Markdown 笔记本：边写边预览，支持自定义正文主题、内嵌图片和多格式导出，并同时运行在浏览器与 Tauri 桌面端。

## 功能

- CodeMirror 编辑与 markdown-it 实时预览
- 笔记、文件夹、搜索、重命名和删除
- 主题工场：令牌、暗色套、附加 CSS、导入导出
- 图片粘贴、拖拽和按钮插入，自动内嵌压缩
- Markdown、独立 HTML、PDF 导出
- Web 与 Tauri 双轨运行

## 开发

```bash
npm install
npm run dev        # 浏览器开发 http://localhost:1420
npm run build      # 类型检查 + Vite 构建
npm run lint       # ESLint
npm run tauri:dev  # Tauri 桌面开发
```

## 项目地图

接手项目或修改架构前，先阅读 [docs/项目地图.md](docs/项目地图.md)。它是目录、依赖方向、数据流、平台接口、持久化协议和开发约束的唯一权威说明。
