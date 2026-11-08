import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * 统一 hover 提示:全项目替代原生 `title` 属性(图标按钮、截断文本、表单控件提示语)。
 * 触发元素经 TooltipTrigger asChild 合并,必须是可转发 ref 的元素
 * (shadcn Button、Radix 原语、原生元素均可)。
 * 自带 Provider:不依赖外层是否挂过 TooltipProvider,任何挂载点都可用。
 */
export function Tip({
  label,
  side,
  children,
}: {
  /** undefined/空串 = 无提示(触发器结构保持不变,仅不渲染内容——条件提示不引发重挂载) */
  label?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        {label ? <TooltipContent side={side}>{label}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
  )
}
