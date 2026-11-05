import { PanelsTopLeft, Palette, FileOutput, HardDrive } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DotPattern } from "@/components/dot-pattern"

const stats = [
  {
    icon: PanelsTopLeft,
    value: "3 种",
    label: "编辑视图",
    description: "实时预览 · 分屏 · 纯编辑",
  },
  {
    icon: Palette,
    value: "100+",
    label: "可定制样式项",
    description: "字体颜色间距逐项设置",
  },
  {
    icon: FileOutput,
    value: "3 种",
    label: "导出格式",
    description: "Markdown · HTML · PDF",
  },
  {
    icon: HardDrive,
    value: "100%",
    label: "数据本地存储",
    description: "无需注册 · 离线可用",
  },
]

export function StatsSection() {
  return (
    <section className="py-12 sm:py-16 relative">
      {/* Background with transparency */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-transparent to-secondary/20" />
      <DotPattern className="opacity-75" size="md" fadeStyle="circle" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="text-center bg-background/60 backdrop-blur-sm border-border/50 py-0"
            >
              <CardContent className="p-6">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <stat.icon className="size-6 text-primary" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {stat.value}
                  </h3>
                  <p className="font-semibold text-foreground">{stat.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {stat.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
