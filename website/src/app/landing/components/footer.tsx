import { Separator } from "@/components/ui/separator"
import { Github } from "@/components/icons/brand-icons"
import { ThemdLogo } from "@/components/ThemdLogo"
import { GITHUB_URL } from "@/lib/urls"
import { useLang } from "@/lib/i18n/i18n-context"

export function LandingFooter() {
  const { t } = useLang()

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid gap-12 lg:grid-cols-5 mb-12">
          {/* Brand */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-4">
              <ThemdLogo className="h-7 w-auto" />
            </div>
            <p className="text-muted-foreground max-w-sm mb-6">
              {t.footer.description}
            </p>
            <div className="flex items-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.common.githubRepo}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="size-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {t.footer.columns.map((column) => (
            <div key={column.title}>
              <h4 className="font-semibold mb-4">{column.title}</h4>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="mb-8" />

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>{t.footer.copyright}</p>
          <p>{t.footer.deployment}</p>
        </div>
      </div>
    </footer>
  )
}
