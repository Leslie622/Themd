import { Download, Apple, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DotPattern } from "@/components/dot-pattern"
import { GITHUB_URL, DOWNLOAD_URL } from "@/lib/urls"
import { useLang } from "@/lib/i18n/i18n-context"

export function DownloadSection() {
  const { t } = useLang()

  return (
    <section id="download" className="py-24 sm:py-32 relative">
      <div className="absolute inset-0">
        <DotPattern className="opacity-75" size="md" fadeStyle="ellipse" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            {t.download.title}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t.download.security}
          </p>
        </div>

        {/* Windows primary card */}
        <Card className="mx-auto max-w-xl shadow-lg border-primary/30">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 w-fit p-4 bg-primary/10 rounded-2xl">
              <Download className="size-10 text-primary" aria-hidden="true" />
            </div>
            <h3 className="text-2xl font-bold mb-2">{t.download.cardTitle}</h3>
            <p className="text-muted-foreground mb-2">
              {t.download.cardRequirement}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              {t.download.cardInfo}
            </p>
            <Button
              size="lg"
              className="w-full text-base cursor-pointer"
              nativeButton={false}
              render={<a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />}
            >
              <Download data-icon="inline-start" />
              {t.download.cardAction}
            </Button>
          </CardContent>
        </Card>

        {/* Other platforms - planned */}
        <div className="mx-auto max-w-xl mt-6 grid grid-cols-2 gap-4">
          <Card className="opacity-60">
            <CardContent className="p-5 flex items-center gap-3">
              <Apple className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground text-sm">macOS</p>
                <p className="text-xs text-muted-foreground">{t.download.planned}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardContent className="p-5 flex items-center gap-3">
              <Terminal className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground text-sm">Linux</p>
                <p className="text-xs text-muted-foreground">{t.download.planned}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          {t.download.feedbackPre}
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            GitHub Issues
          </a>
          {t.download.feedbackPost}
        </p>
      </div>
    </section>
  )
}
