/**
 * 滚动条「滚动浮现 / 静止淡出」的统一时序。
 *
 * 任何滚动容器在滚动期间挂 .osb-active,静止 900ms 后摘掉:
 * - Radix 浮动滚动条(AutoHideScrollArea)靠它控制 [data-autohide] 的显隐;
 * - 原生 ::-webkit-scrollbar(CM 编辑器、弹层菜单、代码块)由
 *   installGlobalScrollbarFade 的 document 捕获级 scroll 监听统一接管
 *   (scroll 不冒泡但走捕获,一个监听覆盖全产品所有滚动容器),
 *   thumb 默认透明只留轨位,点亮才上色(见 index.css 全局滚动条段)。
 * 显隐节奏全产品一致,hover 不点亮——「不滚动就不出现」。
 */

const IDLE_HIDE_MS = 900

const timers = new WeakMap<Element, number>()

function cancelTimer(el: Element) {
  const t = timers.get(el)
  if (t !== undefined) {
    window.clearTimeout(t)
    timers.delete(el)
  }
}

/** 滚动即点亮,重新计时静止淡出 */
export function showOnScroll(el: Element) {
  el.classList.add('osb-active')
  cancelTimer(el)
  timers.set(
    el,
    window.setTimeout(() => {
      timers.delete(el)
      el.classList.remove('osb-active')
    }, IDLE_HIDE_MS),
  )
}

/** 悬停在滚动条上期间取消淡出(保持可见可抓取);隐藏态指针事件穿不进来,不会误保持 */
export function holdWhileHovered(el: Element) {
  cancelTimer(el)
}

/** 悬停离开后恢复静止淡出计时(不点亮,只排程) */
export function scheduleHide(el: Element) {
  cancelTimer(el)
  timers.set(
    el,
    window.setTimeout(() => {
      timers.delete(el)
      el.classList.remove('osb-active')
    }, IDLE_HIDE_MS),
  )
}

/** 全局接管原生滚动条显隐:主窗口挂载一次即可 */
export function installGlobalScrollbarFade() {
  document.addEventListener(
    'scroll',
    (e) => {
      if (e.target instanceof Element) showOnScroll(e.target)
    },
    { capture: true, passive: true },
  )
}
