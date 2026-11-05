import { Type, Paintbrush, Shapes, ArrowLeftRight } from "lucide-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CardDecorator } from "@/components/ui/card-decorator"
import { useLang } from "@/lib/i18n/i18n-context"

const valueIcons = [Type, Paintbrush, Shapes, ArrowLeftRight]

export function AboutSection() {
  const { t } = useLang()

  return (
    <section id="studio" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            {t.about.title}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t.about.subtitle}
          </p>
        </div>

        {/* Values Grid */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4 mb-12">
          {t.about.values.map((value, index) => {
            const Icon = valueIcons[index]
            return (
              <Card key={value.title} className="group shadow-xs py-2">
                <CardHeader className="items-center p-8 text-center">
                  <CardDecorator>
                    <Icon className="size-6" aria-hidden />
                  </CardDecorator>
                  <CardTitle className="mt-6 text-balance">
                    {value.title}
                  </CardTitle>
                  <CardDescription className="mt-3">
                    {value.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>

        {/* Highlight points */}
        <div className="mx-auto max-w-3xl text-center mt-16">
          <p className="text-muted-foreground">{t.about.highlight}</p>
        </div>
      </div>
    </section>
  )
}
