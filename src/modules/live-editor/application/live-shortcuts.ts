/**
 * 需要应用层依赖的快捷键(公式块/插图事件)与编辑器扩展的组合出口。
 * 基础扩展在 infrastructure/tiptap-setup(schema 同源);这里只叠加
 * 依赖 appEvents/命令层的部分,LiveEditorPane 统一从这里取扩展。
 */
import { Extension } from '@tiptap/core'

import { appEvents } from '@/shared/events/app-events'
import { liveExtensions } from '../infrastructure/tiptap-setup'
import { insertMathBlock } from './live-commands'

const AppShortcuts = Extension.create({
  name: 'liveAppShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => (insertMathBlock(this.editor), true),
      'Mod-Shift-i': () => (appEvents.emit('insertImage'), true),
    }
  },
})

/** LiveEditorPane 用的完整扩展集 = 基础装配 + 应用层快捷键 */
export function liveEditorExtensions() {
  return [...liveExtensions(), AppShortcuts]
}
