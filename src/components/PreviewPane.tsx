import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'highlight.js/styles/github.css'
import { ListTree, PanelRightClose } from 'lucide-react'

import { ImageLightbox } from '@/components/ImageLightbox'
import { collectLightboxState, type LightboxSlide } from '@/lib/image-lightbox-state'
import { renderMarkdown } from '@/modules/rendering/markdown-renderer'
import { buildOutline, type OutlineItem } from '@/modules/rendering/outline'
import { compileTokens } from '@/lib/theme/compile'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'
import { useEditorPrefs } from '@/store-editor'
import { useExtraCss } from '@/components/theme/useExtraCss'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 预览面板：md.render → .themd-prose 排版;右侧可折叠大纲窄栏(TOC)。
 * 样式链路：主题令牌 → compileTokens → 容器 style 变量 → theme-base.css 消费。
 * 主题来源优先级:笔记级覆盖(noteThemeId) > 全局激活主题。
 * 有暗色令牌套时按应用暗色模式选择;附加 CSS 经 useExtraCss 作用域注入。
 */
export const PreviewPane = memo(function PreviewPane({
  content,
  noteThemeId,
  bindScroller,
}: {
  content: string
  /** 本篇笔记的主题覆盖(P5);未设置跟随全局 */
  noteThemeId?: string
  /** 绑定滚动容器,用于编辑/预览同步滚动 */
  bindScroller?: (el: HTMLElement | null) => void
}) {
  const html = useMemo(() => renderMarkdown(content).html, [content])
  const outline = useMemo(() => buildOutline(content), [content])

  const activeId = useThemeStore((s) => s.activeId)
  const themes = useThemeStore((s) => s.themes)
  const theme = useMemo(() => {
    if (noteThemeId) {
      // listAllThemes = 内置 + 用户主题;笔记覆盖选内置主题时也能命中
      // (id 失效如主题已删除,则回落全局)
      const overridden = listAllThemes({ themes, activeId }).find(
        (t) => t.id === noteThemeId,
      )
      if (overridden) return overridden
    }
    return resolveActiveTheme({ themes, activeId })
  }, [themes, activeId, noteThemeId])
  const isDark = useAppearance((s) => s.isDark)
  const cssVars = useMemo(
    () => compileTokens(theme.tokens, theme.dark, isDark),
    [theme, isDark],
  )
  useExtraCss(theme.id, theme.extraCss)

  // 图片灯箱:事件委托监听渲染出来的 <img>,src 已在渲染期解析(asset:///data/https)。
  // 一次收集本篇全部图片,可在灯箱里左右切换
  const [lightbox, setLightbox] = useState<{ slides: LightboxSlide[]; index: number } | null>(null)
  const handleClick = (e: React.MouseEvent) => {
    const state = collectLightboxState(e.currentTarget, e.target)
    if (!state) return
    // 图片可能包在 <a> 里,拦掉导航
    e.preventDefault()
    setLightbox(state)
  }

  // ── 大纲窄栏 ─────────────────────────────────────────────────────────
  // 滚动容器:既给 bindScroller(编辑/预览同步滚动)又给本组件内部定位当前标题用
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const setScrollEl = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el
      bindScroller?.(el)
    },
    [bindScroller],
  )

  const outlineEnabled = useEditorPrefs((s) => s.outlineEnabled)
  const setOutlineEnabled = useEditorPrefs((s) => s.setOutlineEnabled)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)

  // 滚动时前向扫描定位当前标题(视口顶线之上最后一个标题)。只读不写滚动位置,
  // 与 useSyncScroll 的 120ms 回声抑制互不干扰。rAF 合帧,滚动狂刷也不抖
  const updateActiveHeading = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const headings = container.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')
    if (headings.length === 0) {
      setActiveHeadingId(null)
      return
    }
    const containerTop = container.getBoundingClientRect().top
    let current: string | null = null
    for (const h of headings) {
      if (h.getBoundingClientRect().top - containerTop > 80) break
      current = h.id
    }
    setActiveHeadingId(current)
  }, [])

  const rafRef = useRef(0)
  const handleScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      updateActiveHeading()
    })
  }, [updateActiveHeading])

  // 内容变化(切笔记/防抖预览刷新)后重算一次当前标题
  useEffect(() => {
    updateActiveHeading()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [updateActiveHeading, content])

  const jumpTo = useCallback((id: string) => {
    const container = scrollRef.current
    const el = container?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (!container || !el) return
    // 手动定位而非 scrollIntoView:留 12px 呼吸,且避免滚动最近可滚动祖先之外的层级
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12
    container.scrollTo({ top, behavior: 'smooth' })
  }, [])

  return (
    <div className="relative flex h-full">
      <div
        ref={setScrollEl}
        className="h-full min-w-0 flex-1 overflow-y-auto"
        onClick={handleClick}
        onScroll={handleScroll}
      >
        <article
          className="themd-prose mx-auto px-6 py-8"
          style={cssVars as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <ImageLightbox
          slides={lightbox?.slides ?? []}
          initialIndex={lightbox?.index}
          onClose={() => setLightbox(null)}
        />
      </div>
      {outlineEnabled && outline.length > 0 && (
        <OutlinePanel
          items={outline}
          activeId={activeHeadingId}
          onJump={jumpTo}
          onClose={() => setOutlineEnabled(false)}
        />
      )}
      {!outlineEnabled && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 size-7 text-muted-foreground"
          aria-label="显示大纲"
          title="显示大纲"
          onClick={() => setOutlineEnabled(true)}
        >
          <ListTree />
        </Button>
      )}
    </div>
  )
})

/** 大纲窄栏:标题层级缩进,点击跳转,滚动时高亮当前标题 */
function OutlinePanel({
  items,
  activeId,
  onJump,
  onClose,
}: {
  items: OutlineItem[]
  /** 当前滚动位置对应的标题 id(视口顶线之上最后一个标题) */
  activeId: string | null
  onJump: (id: string) => void
  onClose: () => void
}) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-l bg-sidebar/50">
      <div className="flex items-center justify-between py-1.5 pr-1 pl-3">
        <span className="text-xs font-medium text-muted-foreground">大纲</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label="收起大纲"
          onClick={onClose}
        >
          <PanelRightClose />
        </Button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {items.map((item, i) => (
          <button
            key={`${item.id}-${i}`}
            type="button"
            style={{ paddingLeft: (item.level - 1) * 10 + 8 }}
            className={cn(
              'block w-full truncate rounded-md py-1 pr-2 text-left text-xs',
              activeId === item.id
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
            onClick={() => onJump(item.id)}
            title={item.text}
          >
            {item.text}
          </button>
        ))}
      </nav>
    </aside>
  )
}
