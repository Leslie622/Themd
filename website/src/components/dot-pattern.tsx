"use client"

import { cn } from "@/lib/utils"

interface DotPatternProps {
  className?: string
  size?: "sm" | "md" | "lg"
  fadeStyle?: "ellipse" | "circle" | "none"
}

export function DotPattern({
  className,
  size = "md",
  fadeStyle = "ellipse",
}: DotPatternProps) {
  // Use predefined Tailwind classes instead of template literals for consistency
  const sizeMap = {
    sm: "[background-size:12px_12px]",
    md: "[background-size:16px_16px]",
    lg: "[background-size:20px_20px]",
  }

  const fadeMap = {
    ellipse:
      "[mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]",
    circle:
      "[mask-image:radial-gradient(circle_at_50%_50%,#000_70%,transparent_100%)]",
    none: "",
  }

  return (
    <div
      className={cn(
        "absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)]",
        sizeMap[size],
        fadeMap[fadeStyle],
        className
      )}
    />
  )
}
