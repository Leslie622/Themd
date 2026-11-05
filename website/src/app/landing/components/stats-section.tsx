import { PanelsTopLeft, Palette, FileOutput, HardDrive } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DotPattern } from "@/components/dot-pattern"
import { useLang } from "@/lib/i18n/i18n-context"

const statIcons = [PanelsTopLeft, Palette, FileOutput, HardDrive]

export function StatsSection() {
  const { t } = useLang()

  return (
    <section className="py-12 sm:py-16 relative">
      <DotPattern className="opacity-75" size="md" fadeStyle="circle" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {t.stats.items.map((stat, index) => {
            const Icon = statIcons[index]
            return (
              <Card
                key={stat.label}
                className="text-center bg-background/60 backdrop-blur-sm border-border/50 py-0"
              >
                <CardContent className="p-6">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <Icon className="size-6 text-primary" />
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
            )
          })}
        </div>
      </div>
    </section>
  )
}
