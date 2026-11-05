import { Globe, Package, Code2, FileText, FileOutput } from "lucide-react"
import { Github } from "@/components/icons/brand-icons"
import { DotPattern } from "@/components/dot-pattern"
import { useLang } from "@/lib/i18n/i18n-context"

const targetIcons = [FileText, Code2, Github, Globe]

export function ShareSection() {
  const { t } = useLang()
  const [strip1, strip2, strip3] = t.share.strip

  return (
    <section id="share" className="py-24 sm:py-32 relative">
      <div className="absolute inset-0">
        <DotPattern className="opacity-75" size="md" fadeStyle="circle" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            {t.share.title}
          </h2>
          <p className="text-lg text-muted-foreground">{t.share.subtitle}</p>
        </div>

        {/* Two main ways */}
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          <div className="rounded-xl border bg-card p-8">
            <div className="p-2.5 bg-primary/10 rounded-lg w-fit mb-4">
              <Package className="size-6 text-primary" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight mb-3">
              {t.share.packTitle}
            </h3>
            <p className="text-muted-foreground text-base text-pretty">
              {t.share.packDescription}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-8">
            <div className="p-2.5 bg-primary/10 rounded-lg w-fit mb-4">
              <FileOutput className="size-6 text-primary" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight mb-3">
              {t.share.portableTitle}
            </h3>
            <p className="text-muted-foreground text-base text-pretty">
              {t.share.portableDescription}
            </p>
          </div>
        </div>

        {/* Four portable targets */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {t.share.targets.map((target, index) => {
            const Icon = targetIcons[index]
            return (
              <div
                key={target.name}
                className="rounded-xl border bg-card p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h4 className="font-semibold">{target.name}</h4>
                </div>
                <p className="text-muted-foreground text-sm">{target.description}</p>
              </div>
            )
          })}
        </div>

        {/* Feature strip */}
        <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-success me-1" />
            <span>{strip1}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-info me-1" />
            <span>{strip2}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-warning me-1" />
            <span>{strip3}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
