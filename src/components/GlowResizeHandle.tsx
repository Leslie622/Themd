import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { ResizableHandle } from '@/components/ui/resizable'
import { useDividerGlow } from '@/components/useDividerGlow'

/** 带指针跟随渐变高光的 shadcn ResizableHandle(高光逻辑/样式见 useDividerGlow 与 index.css) */
export function GlowResizeHandle({ className, ...props }: ComponentProps<typeof ResizableHandle>) {
  return <ResizableHandle {...props} elementRef={useDividerGlow()} className={cn('divider-glow', className)} />
}
