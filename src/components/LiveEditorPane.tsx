import { memo, useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'

import { compileTokens } from '@/lib/theme/compile'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'
import { useExtraCss } from '@/components/theme/useExtraCss'
import { LiveEditorController } from '@/modules/live-editor/application/live-editor-controller'
import { liveExtensions } from '@/modules/live-editor/infrastructure/tiptap-setup'

/**
 * 实时预览编辑器(TipTap/ProseMirror,渲染态直接编辑——Typora 式)。
 *
 * - 排版:容器注入主题令牌(--t-*),编辑器元素挂 .themd-prose——与预览/
 *   导出同一套 theme-base.css 排版,编辑即所见
 * - 同步:LiveEditorController 持块级 sourceMap,编辑 → 未动块逐字节原文、
 *   dirty 块序列化,onChange 交给既有防抖写回管线(与 CM 同一条路)
 * - 生命周期:父级 key={noteId} 重挂载(与 CM 同语义);外部改动(重载/冲突
 *   处置)经 rebind 整体重建
 */
export const LiveEditorPane = memo(function LiveEditorPane({
  value,
  onChange,
  noteThemeId,
}: {
  value: string
  onChange: (value: string) => void
  /** 本篇笔记的主题覆盖;未设置跟随全局 */
  noteThemeId?: string
}) {
  // controller 与组件同生命周期(key 重挂载 = 换笔记重建,undo 历史随之清零,
  // 与 CM 的 remount 语义一致)
  const controller = useMemo(() => new LiveEditorController(value), []) // eslint-disable-line react-hooks/exhaustive-deps -- 仅挂载期初值,后续外部改动走 rebind
  const lastEmittedRef = useRef(value)

  const editor = useEditor({
    extensions: [...liveExtensions()],
    content: controller.buildDocJson(),
    // .themd-prose:theme-base.css 的整套排版(标题/引用/表格/代码)直接生效
    editorProps: {
      attributes: { class: 'themd-prose live-prose', spellcheck: 'false' },
    },
    onUpdate: ({ editor }) => {
      const next = controller.onUpdate(editor.state.doc)
      if (next !== null) {
        lastEmittedRef.current = next
        onChange(next)
      }
    },
  })

  // 编辑器就绪:种子化归属表(controller 的 lastNodes 必须是真实节点引用)
  useEffect(() => {
    if (editor) controller.seed(editor.state.doc)
  }, [editor, controller])

  // 外部改动(value ≠ 自己刚发出的):整体重绑,等价 CM 的外部重载
  useEffect(() => {
    if (!editor || value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    editor.commands.setContent(controller.rebind(value), { emitUpdate: false })
    controller.seed(editor.state.doc)
  }, [value, editor, controller])

  // ── 主题令牌(与 PreviewPane 同链路:笔记覆盖 > 全局) ──────────────────
  const activeId = useThemeStore((s) => s.activeId)
  const themes = useThemeStore((s) => s.themes)
  const theme = useMemo(() => {
    if (noteThemeId) {
      const overridden = listAllThemes({ themes, activeId }).find((t) => t.id === noteThemeId)
      if (overridden) return overridden
    }
    return resolveActiveTheme({ themes, activeId })
  }, [themes, activeId, noteThemeId])
  const isDark = useAppearance((s) => s.isDark)
  const cssVars = useMemo(() => compileTokens(theme.tokens, theme.dark, isDark), [theme, isDark])
  useExtraCss(theme.id, theme.extraCss)

  return (
    <div className="h-full overflow-y-auto" style={cssVars}>
      <EditorContent editor={editor} className="live-editor-shell" />
    </div>
  )
})
