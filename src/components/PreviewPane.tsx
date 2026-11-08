import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import 'highlight.js/styles/github.css'
import { IconListTree, IconLayoutSidebarRightCollapse } from '@tabler/icons-react'

import { ImageLightbox } from '@/components/ImageLightbox'
import { AutoHideScrollArea } from '@/components/AutoHideScrollArea'
import { Tip } from '@/components/Tip'
import { collectLightboxState, type LightboxSlide } from '@/lib/image-lightbox-state'
import { renderStaticHtml } from '@/modules/rendering/static-html'
import { buildCodeButtons } from '@/modules/rendering/codeblock-chrome'
import { buildOutline, type OutlineItem } from '@/modules/rendering/outline'
import { compileTokens } from '@/lib/theme/compile'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'
import { useEditorPrefs } from '@/store-editor'
import { useExtraCss } from '@/components/theme/useExtraCss'
import { platformServices } from '@/app/platform'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { GlowResizeHandle } from '@/components/GlowResizeHandle'
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
  // 渲染统一第 3 步:预览切 TipTap 静态管线(与实时编辑同源 schema,
  // 守门 golden/golden-parity 与 md-it 冻结期望逐字节一致)
  const html = useMemo(() => renderStaticHtml(content), [content])
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
  // 预览里的 <a> 带真实 href,点击的默认行为是 WebView 直接导航,
  // 会把整个应用页面替换掉——拦截后交系统浏览器打开
  const handleClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a[href]')
    if (anchor) {
      e.preventDefault()
      platformServices.files
        .openUrl(anchor.getAttribute('href') ?? '')
        .catch(() => toast.error('打开链接失败'))
      return
    }
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

  // ── 大纲折叠动画 ────────────────────────────────────────────────────
  // 面板常挂载(collapsible),收起/展开走 panelRef 命令:仅在程序化切换的
  // ~200ms 里给两块面板临时挂 flex-grow 过渡(拖拽路径无过渡,不受影响)。
  // 过渡期间冻结大纲内容宽防逐帧挤压(与侧栏折叠同一手法),展开完成才解冻。
  // outlineEnabled 不再决定挂载,只经 onResize/isCollapsed 镜像面板真实状态
  const outlinePanelRef = useRef<PanelImperativeHandle | null>(null)
  const outlinePanelElRef = useRef<HTMLDivElement | null>(null)
  const previewPanelElRef = useRef<HTMLDivElement | null>(null)
  const [outlineContentW, setOutlineContentW] = useState<number | null>(null)
  const lastOutlineWRef = useRef(0)
  const outlineCollapsedKnownRef = useRef(false)
  const outlineTweenSeq = useRef(0)
  const outlineTweenActiveRef = useRef(false)

  const beginOutlineTween = useCallback(() => {
    const seq = ++outlineTweenSeq.current
    outlineTweenActiveRef.current = true
    const els = [outlinePanelElRef.current, previewPanelElRef.current]
    let timer = 0
    const finish = () => {
      if (outlineTweenSeq.current !== seq) return
      outlineTweenActiveRef.current = false
      if (timer) window.clearTimeout(timer)
      for (const el of els) if (el) el.style.transition = ''
      // 展开完成才解冻内容宽;收起完成保持冻结,留给下次展开做整宽揭示
      if (!outlinePanelRef.current?.isCollapsed()) setOutlineContentW(null)
    }
    for (const el of els) {
      if (!el) continue
      // 库 v4 的面板宽度由 flex-grow 驱动(getPanelStyles 只写 flexGrow,basis 恒 0),
      // 过渡必须挂在 flex-grow 上,flex-basis 不变永远没有动画
      el.style.transition = 'flex-grow 200ms ease-out'
      el.addEventListener(
        'transitionend',
        (e) => {
          // 只认面板自身的 flex-grow 过渡,子元素(滚动条等)冒泡的不触发收尾
          if (e.target === el && e.propertyName === 'flex-grow') finish()
        },
        { once: true },
      )
    }
    // 后台页签 transitionend 可能迟到,定时兜底(幂等)
    timer = window.setTimeout(finish, 400)
  }, [])

  /** 程序化收起/展开大纲;偏好由 onResize 镜像,这里不直写 */
  const toggleOutline = useCallback(
    (open: boolean) => {
      const panel = outlinePanelRef.current
      if (!panel) return
      const collapsed = panel.isCollapsed()
      if (collapsed === !open) return
      if (!open) {
        setOutlineContentW(panel.getSize().inPixels)
      } else if (outlineContentW == null) {
        // 拖拽塌缩过的面板没有冻结宽可复用,用最近一次展开宽兜底
        setOutlineContentW(lastOutlineWRef.current || null)
      }
      beginOutlineTween()
      // 目标态同步直写:浮钮/内容 inert 即刻生效,不等 ResizeObserver 回调
      // (后台页签 RO 冻结);拖拽路径仍由 onResize 镜像,程序化回声经去重为空操作
      setOutlineEnabled(open)
      if (open) {
        if (collapsed) panel.expand()
        else panel.resize(lastOutlineWRef.current || '40')
      } else {
        panel.collapse()
      }
    },
    [beginOutlineTween, outlineContentW, setOutlineEnabled],
  )

  // 首挂对齐持久化偏好:禁用态在 pre-paint 阶段塌缩,不闪 40% 宽的帧
  useLayoutEffect(() => {
    if (!outlineEnabled) outlinePanelRef.current?.collapse()
  }, [outlineEnabled])

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

  // mermaid 占位容器 → 异步渲染 SVG(缓存命中零成本;失败保留源码文本兜底)
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const holders = [...container.querySelectorAll<HTMLElement>('.themd-mermaid')]
    if (holders.length === 0) return
    let cancelled = false
    void (async () => {
      const { renderMermaidSvg } = await import('@/modules/live-editor/infrastructure/mermaid-render')
      if (cancelled) return
      for (const el of holders) {
        const src = decodeURIComponent(el.dataset.src ?? '')
        if (!src) continue
        try {
          el.innerHTML = await renderMermaidSvg(src, isDark)
        } catch {
          el.classList.add('themd-mermaid-fallback') // 保留源码文本
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [html, isDark])

  // 代码块 header 交互层注入:规范 HTML 只含观感层(.themd-code-lang),
  // 复制/换行按钮在此按偏好追加(应用内装饰,导出产物天然不带)。
  // data-themd-chrome 标记防重复注入(html 变更后 DOM 重建,标记随旧 DOM 消失)
  const codeCopyEnabled = useEditorPrefs((s) => s.codeCopyButtonEnabled)
  const codeWrapBtnEnabled = useEditorPrefs((s) => s.codeWrapButtonEnabled)
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    for (const el of container.querySelectorAll<HTMLElement>('.themd-code')) {
      if (el.dataset.themdChrome) continue
      el.dataset.themdChrome = '1'
      const lang = el.querySelector<HTMLElement>('.themd-code-lang')
      if (!lang) continue
      lang.appendChild(
        buildCodeButtons(
          {
            onToggleWrap: (wrapped) => el.classList.toggle('themd-code-wrap', wrapped),
          },
          { copyButton: codeCopyEnabled, wrapButton: codeWrapBtnEnabled },
        ),
      )
    }
  }, [html, codeCopyEnabled, codeWrapBtnEnabled])

  const jumpTo = useCallback((id: string) => {
    const container = scrollRef.current
    const el = container?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (!container || !el) return
    // 手动定位而非 scrollIntoView:留 12px 呼吸,且避免滚动最近可滚动祖先之外的层级
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12
    container.scrollTo({ top, behavior: 'smooth' })
  }, [])

  return (
    <div className="relative h-full">
      {/* 大纲分栏用官方 Resizable(与编辑/预览分屏同款;分屏本身不做宽度持久化) */}
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel
          id="outline-preview"
          defaultSize={outline.length > 0 ? '60' : '100'}
          minSize="40"
          elementRef={previewPanelElRef}
        >
          <AutoHideScrollArea
            viewportRef={setScrollEl}
            className="h-full min-w-0"
            // 画布背景铺在滚动容器(正文纸张之外);纸张颜色仍在 article 上
            viewportProps={{
              style: { background: cssVars['--t-app-bg'] },
              onClick: handleClick,
              onScroll: handleScroll,
            }}
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
          </AutoHideScrollArea>
        </ResizablePanel>
        {/* 大纲面板常挂载(有标题时):收起 = collapsible 塌缩到 0,动画由 toggleOutline 驱动;
            拖拽越过塌缩阈值同样经 onResize 落偏好 */}
        {outline.length > 0 && (
          <>
            <GlowResizeHandle withHandle />
            <ResizablePanel
              id="outline-panel"
              panelRef={outlinePanelRef}
              elementRef={outlinePanelElRef}
              defaultSize="40"
              minSize="12"
              maxSize="45"
              collapsible
              className={cn(outlineContentW != null && 'overflow-hidden')}
              onResize={(size) => {
                const panel = outlinePanelRef.current
                const collapsed = panel ? panel.isCollapsed() : true
                if (!collapsed && size.inPixels > 0) lastOutlineWRef.current = size.inPixels
                // 拖拽路径在这里解冻(程序化路径由过渡收尾解冻)
                if (!collapsed && !outlineTweenActiveRef.current) setOutlineContentW(null)
                if (collapsed !== outlineCollapsedKnownRef.current) {
                  outlineCollapsedKnownRef.current = collapsed
                  setOutlineEnabled(!collapsed)
                }
              }}
            >
              <div
                className="h-full"
                style={outlineContentW != null ? { width: outlineContentW } : undefined}
                inert={!outlineEnabled || undefined}
              >
                <OutlinePanel
                  items={outline}
                  activeId={activeHeadingId}
                  onJump={jumpTo}
                  onClose={() => toggleOutline(false)}
                />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {!outlineEnabled && (
        <Tip label="显示大纲" side="bottom">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-7 text-muted-foreground"
            aria-label="显示大纲"
            onClick={() => toggleOutline(true)}
          >
            <IconListTree />
          </Button>
        </Tip>
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
    <aside className="flex h-full flex-col border-l bg-sidebar/50">
      <div className="flex items-center justify-between py-1.5 pr-1 pl-3">
        <span className="text-xs font-medium text-muted-foreground">大纲</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label="收起大纲"
          onClick={onClose}
        >
          <IconLayoutSidebarRightCollapse />
        </Button>
      </div>
      <AutoHideScrollArea className="min-h-0 flex-1" viewportProps={{ className: 'px-2 pb-3' }}>
        <div className="space-y-0.5">
        {items.map((item, i) => (
          <Tip key={`${item.id}-${i}`} label={item.text}>
            <button
              type="button"
              style={{ paddingLeft: (item.level - 1) * 10 + 8 }}
              className={cn(
                'block w-full truncate rounded-md py-1 pr-2 text-left text-xs',
                activeId === item.id
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
              onClick={() => onJump(item.id)}
            >
              {item.text}
            </button>
          </Tip>
        ))}
        </div>
      </AutoHideScrollArea>
    </aside>
  )
}
