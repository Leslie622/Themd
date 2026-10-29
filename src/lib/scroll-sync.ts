import { useCallback, useEffect, useRef } from 'react'

import { useEditorPrefs } from '@/store-editor'

/**
 * 编辑/预览比例同步滚动:按「滚动进度」(scrollTop / 可滚动高度)互相映射。
 *
 * 防回环:写对方 scrollTop 会触发对方 scroll 事件,若不拦截两边会互相追逐。
 * 做法——映射时给目标元素盖一个 120ms 的「回声抑制」时间戳;源头事件永不被锁,
 * 所以连续滚动时每一帧都同步,只有对方被程序写入后短暂窗口内的事件被忽略。
 * 两侧元素任一缺席即为 no-op,视图切换(编辑/分屏/预览)时自动失效。
 *
 * 设置里的「同步滚动」开关在事件回调里经 getState 即时读取:关闭后绑定仍在,
 * 仅同步变 no-op,再次打开零延迟恢复。
 */
export function useSyncScroll() {
  const editorEl = useRef<HTMLElement | null>(null)
  const previewEl = useRef<HTMLElement | null>(null)
  const suppressedUntil = useRef(new WeakMap<HTMLElement, number>())

  const map = (from: HTMLElement, to: HTMLElement) => {
    const fromMax = from.scrollHeight - from.clientHeight
    const toMax = to.scrollHeight - to.clientHeight
    if (fromMax < 1 || toMax < 1) return
    suppressedUntil.current.set(to, performance.now() + 120)
    to.scrollTop = (from.scrollTop / fromMax) * toMax
  }

  // 经 ref 间接调用:监听器 useCallback([]) 保持稳定,重渲染不重复挂载
  const handlers = useRef<{ editor(): void; preview(): void }>({
    editor() {},
    preview() {},
  })
  useEffect(() => {
    handlers.current = {
      editor() {
        if (!useEditorPrefs.getState().syncScrollEnabled) return
        const ed = editorEl.current
        const pv = previewEl.current
        if (!ed || !pv) return
        if ((suppressedUntil.current.get(ed) ?? 0) > performance.now()) return
        map(ed, pv)
      },
      preview() {
        if (!useEditorPrefs.getState().syncScrollEnabled) return
        const ed = editorEl.current
        const pv = previewEl.current
        if (!ed || !pv) return
        if ((suppressedUntil.current.get(pv) ?? 0) > performance.now()) return
        map(pv, ed)
      },
    }
  })

  const onEditorScroll = useCallback(() => handlers.current.editor(), [])
  const onPreviewScroll = useCallback(() => handlers.current.preview(), [])

  const bindEditorScroller = useCallback(
    (el: HTMLElement | null) => {
      editorEl.current?.removeEventListener('scroll', onEditorScroll)
      editorEl.current = el
      el?.addEventListener('scroll', onEditorScroll, { passive: true })
    },
    [onEditorScroll],
  )
  const bindPreviewScroller = useCallback(
    (el: HTMLElement | null) => {
      previewEl.current?.removeEventListener('scroll', onPreviewScroll)
      previewEl.current = el
      el?.addEventListener('scroll', onPreviewScroll, { passive: true })
    },
    [onPreviewScroll],
  )

  return { bindEditorScroller, bindPreviewScroller }
}
