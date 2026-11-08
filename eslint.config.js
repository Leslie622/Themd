import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // website/ 是独立 Vite 项目(自己的 eslint.config.js 与 npm scripts),零共享代码,
  // 桌面端规则不适用;toggle-preview.tsx 是提交在库里的开发预览实验台(无导出的
  // 单文件组件,不进打包图),react-refresh 的单文件约束对它无意义
  globalIgnores(['dist', 'website', 'src/toggle-preview.tsx', 'src-tauri/target', 'src-tauri/gen']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // shadcn 生成文件:导出 cva variants 是注册表固有模式,关掉 fast-refresh 单组件约束
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
