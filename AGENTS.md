# Themd

样式自设的本地 Markdown 笔记本（React 19 + Vite 7 + Tailwind v4 + shadcn/ui + CodeMirror 6 + markdown-it）。

**接手本项目前，先读 [docs/项目地图.md](docs/项目地图.md)**：目录结构、依赖方向、核心数据流、平台接口、持久化协议和已知坑位都在那里。项目地图是唯一权威架构说明；修改这些事实时必须同步更新地图。

架构约束：domain 不依赖 React/Zustand/DOM/Tauri；应用与组件通过 Repository/Platform contracts 访问存储和平台能力；组件不得直接调用 Tauri `invoke` 或 IndexedDB。旧 Store 文件仅作为迁移兼容入口，新功能不要继续扩展。

常用命令：`npm run dev`（开发）/ `npm run build`（类型检查 + 构建）/ `npm run lint` / `npm run test` / `npm run tauri:dev` / `cargo check --manifest-path src-tauri/Cargo.toml` / `npx shadcn@latest add <组件名>`（加 UI 组件）。
