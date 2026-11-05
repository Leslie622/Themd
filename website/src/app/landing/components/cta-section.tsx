import { Download } from "lucide-react"
import { Github } from "@/components/icons/brand-icons"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { GITHUB_URL, DOWNLOAD_URL } from "@/lib/urls"
import { useLang } from "@/lib/i18n/i18n-context"

export function CTASection() {
  const { t } = useLang()
  const [status1, status2, status3] = t.cta.statusWords

  return (
    <section className="py-16 lg:py-24 bg-muted/80">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <div className="flex flex-col gap-8">
              {/* Status words */}
              <div className="flex flex-col items-center gap-4">
                <div className="text-muted-foreground flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <div className="size-2 rounded-full bg-success" />
                    {status1}
                  </span>
                  <Separator orientation="vertical" className="h-4! data-vertical:self-center" />
                  <span>{status2}</span>
                  <Separator orientation="vertical" className="h-4! data-vertical:self-center" />
                  <span>{status3}</span>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex flex-col gap-6">
                <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  {t.cta.titlePre}
                  <span className="flex sm:inline-flex justify-center">
                    <span className="relative mx-2">
                      <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        {t.cta.titleAccent}
                      </span>
                      <div className="absolute start-0 -bottom-2 h-1 w-full bg-gradient-to-r from-primary/30 to-primary/10" />
                    </span>
                  </span>
                </h2>

                <p className="text-muted-foreground mx-auto max-w-2xl text-balance lg:text-xl">
                  {t.cta.subtitle}
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col justify-center gap-4 sm:flex-row sm:items-center sm:gap-6">
                <Button
                  size="lg"
                  className="cursor-pointer h-12 px-8 text-lg font-medium leading-none has-data-[icon=inline-start]:pl-8"
                  nativeButton={false}
                  render={
                    <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <Download className="size-5" data-icon="inline-start" />
                  {t.cta.download}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="cursor-pointer h-12 px-8 text-lg font-medium leading-none group has-data-[icon=inline-start]:pl-8"
                  nativeButton={false}
                  render={
                    <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <Github className="size-5" data-icon="inline-start" />
                  {t.cta.github}
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-success me-1" />
                  <span>{t.cta.trust[0]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-info me-1" />
                  <span>{t.cta.trust[1]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-warning me-1" />
                  <span>{t.cta.trust[2]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
