# Themd 产品官网

部署于 GitHub Pages:https://leslie622.github.io/Themd/

- 独立 Vite 项目(React 19 + Tailwind v4 + shadcn),与桌面端代码零共享
- 本地开发:`npm install && npm run dev`(注意 vite base=/Themd/,dev 时访问 http://localhost:5173/Themd/)
- 构建产物为纯静态站,由 `.github/workflows/website.yml` 自动部署(改 website/** 即触发)
- 桌面端架构说明见仓库根 docs/项目地图.md
