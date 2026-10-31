import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 应用字体设置。持久化 key `themd/ui-preferences/v1`;
 * 注入为 html 上的 CSS 变量,由 index.css / EditorPane 消费:
 * - --font-ui-sans  界面字体(整产品 UI,编辑器未自定义时也用它)
 * - --font-editor   编辑器字体(默认 JetBrains Mono,自定义后替换)
 * - --font-editor-size 编辑器字号
 * 字体栈为「西文, 中文, 通用族」:西文字体不含汉字,浏览器按字符
 * 自动分流到中文字体(VSCode 同款做法)。
 */

/** 界面/编辑器字体栈。western 与 cjk 留空时回落默认链 */
export function buildFontStack(western: string, cjk: string, fallback: string): string {
  const parts: string[] = []
  const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-monospace', 'ui-sans-serif', 'ui-serif', 'ui-rounded'])
  const formatFamily = (value: string) => GENERIC_FAMILIES.has(value) || value.includes(' ') ? (GENERIC_FAMILIES.has(value) ? value : `'${value}'`) : `'${value}'`
  if (western.trim()) {
    // 自定义输入允许整段 font-family 值(逗号分隔);预设是单个族名
    for (const p of western.split(',')) {
      const f = p.trim()
      if (f) parts.push(/^[\w-]+$/.test(f) ? formatFamily(f) : f)
    }
  }
  if (cjk.trim()) {
    const f = cjk.trim()
    parts.push(/^[\w-]+$/.test(f) ? formatFamily(f) : f)
  }
  parts.push(fallback)
  return parts.join(', ')
}

interface EditorPrefsState {
  /** CodeMirror 字号(px) */
  fontSize: number
  /** 界面西文字体:空 = Geist Variable(打包默认) */
  uiFontWestern: string
  /** 界面中文字体:空 = 系统默认链 */
  uiFontCjk: string
  /** 编辑器西文字体:空 = JetBrains Mono(打包默认) */
  editorFontWestern: string
  /** 编辑器中文字体:HarmonyOS Sans SC(打包默认) */
  editorFontCjk: string
  /** 代码折叠箭头开关 */
  foldEnabled: boolean
  /** 编辑↔预览同步滚动开关 */
  syncScrollEnabled: boolean
  /** 编辑器自动换行(关闭时长行横向滚动) */
  lineWrapEnabled: boolean
  /**
   * 图片存储模式。assets = 本地文件夹(默认,markdown 写 assets/xxx 相对路径,
   * 导出的 .md 干净可读);embedded = base64 内嵌正文(单文件自包含);
   * remote = 上传图床(正文写外链 URL,Typora/PicGo 式)。
   * 浏览器端无本地文件能力,本地文件夹模式在 Web 被禁用。
   */
  imageMode: 'assets' | 'embedded' | 'remote'
  /**
   * 本地图片根目录(绝对路径)。空 = 用平台默认(桌面端为应用数据目录)。
   * 图片实际落在 `${assetsRoot}/assets/`,正文引用 `assets/<文件名>` 相对路径。
   */
  assetsRoot: string
  /** 图床服务商:GitHub 仓库 / PicGo 本地桥(用户自配,可换任意对象存储) */
  uploaderProvider: 'github' | 'picgo'
  /** GitHub 仓库(owner/repo),图片以 assets/ 路径提交 */
  githubRepo: string
  /** GitHub token(需 repo Contents 读写权限) */
  githubToken: string
  /** PicGo Server 上传接口地址(端口可在 PicGo 里改) */
  picgoUrl: string
  setFontSize: (px: number) => void
  setUiFont: (western: string, cjk: string) => void
  setEditorFont: (western: string, cjk: string) => void
  setFoldEnabled: (v: boolean) => void
  setSyncScrollEnabled: (v: boolean) => void
  setLineWrapEnabled: (v: boolean) => void
  setImageMode: (mode: 'assets' | 'embedded' | 'remote') => void
  setAssetsRoot: (root: string) => void
  /** 图床配置批量更新(设置抽屉各字段共用) */
  setUploader: (patch: Partial<Pick<EditorPrefsState, 'uploaderProvider' | 'githubRepo' | 'githubToken' | 'picgoUrl'>>) => void
}

const MIN = 11
const MAX = 22
const applySize = (px: number) => {
  document.documentElement.style.setProperty('--font-editor-size', `${px}px`)
}

/** 界面默认字体链(中文默认使用打包的鸿蒙黑体) */
const DEFAULT_UI_STACK = "'Geist Variable', 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"
/** 编辑器默认字体链(西文使用打包的 JetBrains Mono,中文按字符回落) */
export const DEFAULT_EDITOR_STACK = "'JetBrains Mono', 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', monospace"

const applyFonts = (s: Pick<EditorPrefsState, 'uiFontWestern' | 'uiFontCjk' | 'editorFontWestern' | 'editorFontCjk'>) => {
  const root = document.documentElement.style
  const ui =
    s.uiFontWestern.trim() || s.uiFontCjk.trim()
      ? buildFontStack(s.uiFontWestern, s.uiFontCjk, 'sans-serif')
      : DEFAULT_UI_STACK
  const editor =
    s.editorFontWestern.trim() || s.editorFontCjk.trim()
      ? buildFontStack(s.editorFontWestern, s.editorFontCjk, 'monospace')
      : DEFAULT_EDITOR_STACK
  root.setProperty('--font-ui-sans', ui)
  root.setProperty('--font-ui-serif', buildFontStack(s.uiFontWestern, s.uiFontCjk, 'serif'))
  // 始终注入编辑器字体:默认也必须锁定为打包的 JetBrains Mono。
  root.setProperty('--font-editor', editor)
}

const DEFAULTS = {
  fontSize: 13.5,
  /** 空 = 西文不单独指定,由中文字体/通用族承担(中文字体通常自带拉丁字形) */
  uiFontWestern: '',
  uiFontCjk: 'HarmonyOS Sans SC',
  editorFontWestern: 'JetBrains Mono',
  editorFontCjk: 'HarmonyOS Sans SC',
  foldEnabled: true,
  syncScrollEnabled: true,
  lineWrapEnabled: true,
  /** 默认本地文件夹:导出的 .md 干净,base64 内嵌退为可选项 */
  imageMode: 'assets' as 'assets' | 'embedded' | 'remote',
  /** 空 = 平台默认(桌面端应用数据目录);浏览器端被 UI 强制 embedded,不走此值 */
  assetsRoot: '',
  uploaderProvider: 'github' as 'github' | 'picgo',
  githubRepo: '',
  githubToken: '',
  picgoUrl: 'http://127.0.0.1:36677/upload',
}

export const useEditorPrefs = create<EditorPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setFontSize: (px) => {
        const clamped = Math.min(MAX, Math.max(MIN, Math.round(px * 2) / 2))
        applySize(clamped)
        set({ fontSize: clamped })
      },
      setUiFont: (western, cjk) => {
        applyFonts({ ...useEditorPrefs.getState(), uiFontWestern: western, uiFontCjk: cjk })
        set({ uiFontWestern: western, uiFontCjk: cjk })
      },
      setEditorFont: (western, cjk) => {
        applyFonts({ ...useEditorPrefs.getState(), editorFontWestern: western, editorFontCjk: cjk })
        set({ editorFontWestern: western, editorFontCjk: cjk })
      },
      setFoldEnabled: (v) => set({ foldEnabled: v }),
      setSyncScrollEnabled: (v) => set({ syncScrollEnabled: v }),
      setLineWrapEnabled: (v) => set({ lineWrapEnabled: v }),
      setImageMode: (mode) => set({ imageMode: mode }),
      setAssetsRoot: (root) => set({ assetsRoot: root }),
      setUploader: (patch) => set(patch),
    }),
    {
      name: 'themd/ui-preferences/v1',
      version: 6,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<EditorPrefsState>
        const next = { ...DEFAULTS, ...state }
        // v1 的空值表示“跟随界面”;v2 起编辑器字体落到具体默认值。
        // v3 界面中文字体落具体值(设置槽位可回显);西文保持空 = 不单独指定。
        // v4 图片存储模式登场,存量用户一律落新默认 assets(旧数据是内嵌态,
        // 正文不受影响,只是新插入的图片开始走本地文件夹)
        // v5 图床模式登场:imageMode 补 'remote' 合法值,上传配置落默认
        // v6 移除 SM.MS/s.ee 路线:存量 provider(含 smms)回落 github
        if (version < 2) {
          if (!next.editorFontWestern?.trim()) next.editorFontWestern = 'JetBrains Mono'
          if (!next.editorFontCjk?.trim()) next.editorFontCjk = 'HarmonyOS Sans SC'
        }
        if (version < 3) {
          if (!next.uiFontCjk?.trim()) next.uiFontCjk = 'HarmonyOS Sans SC'
        }
        if (version < 4) {
          if (next.imageMode !== 'assets' && next.imageMode !== 'embedded') next.imageMode = 'assets'
        }
        if (version < 5) {
          if (next.imageMode !== 'assets' && next.imageMode !== 'embedded' && next.imageMode !== 'remote') {
            next.imageMode = 'assets'
          }
          if (!next.picgoUrl?.trim()) next.picgoUrl = 'http://127.0.0.1:36677/upload'
        }
        if (version < 6) {
          if (next.uploaderProvider !== 'github' && next.uploaderProvider !== 'picgo') {
            next.uploaderProvider = 'github'
          }
        }
        return next
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applySize(state.fontSize)
          applyFonts(state)
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  applySize(useEditorPrefs.getState().fontSize)
  applyFonts(useEditorPrefs.getState())
  useEditorPrefs.subscribe((s) => {
    applySize(s.fontSize)
    applyFonts(s)
  })
}

export const EDITOR_FONT_RANGE = { MIN, MAX } as const

/** 界面/编辑器共用的西文字体候选(预设 + 本机探测列表由 UI 层合并) */
export const UI_FONT_PRESETS = [
  { label: 'Geist(默认)', value: 'Geist Variable' },
  { label: 'HarmonyOS Sans SC', value: 'HarmonyOS Sans SC' },
  { label: '系统界面字体', value: 'system-ui' },
  { label: 'Segoe UI(Windows)', value: 'Segoe UI' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman(衬线)', value: 'Times New Roman' },
]

/** 等宽/编程字体候选(编辑器西文) */
export const MONO_FONT_PRESETS = [
  { label: 'JetBrains Mono(内置默认)', value: 'JetBrains Mono' },
  { label: '跟随系统等宽', value: 'ui-monospace' },
  { label: 'Consolas(Windows)', value: 'Consolas' },
  { label: 'Cascadia Code(Win11)', value: 'Cascadia Code' },
  { label: 'Fira Code', value: 'Fira Code' },
  { label: 'Source Code Pro', value: 'Source Code Pro' },
  { label: 'SF Mono(macOS)', value: 'SF Mono' },
  { label: 'Menlo(macOS)', value: 'Menlo' },
]

/** 中文字体候选 */
export const CJK_FONT_PRESETS = [
  { label: '系统默认', value: '' },
  { label: 'HarmonyOS Sans SC(打包默认)', value: 'HarmonyOS Sans SC' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '苹方(macOS)', value: 'PingFang SC' },
  { label: '思源黑体', value: 'Source Han Sans SC' },
  { label: 'Noto Sans SC', value: 'Noto Sans SC' },
  { label: '宋体', value: 'SimSun' },
  { label: '楷体', value: 'KaiTi' },
]
