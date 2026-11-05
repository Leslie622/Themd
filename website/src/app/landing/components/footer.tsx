import { Separator } from "@/components/ui/separator"
import { Github } from "@/components/icons/brand-icons"
import { ThemdLogo } from "@/components/ThemdLogo"

const GITHUB_URL = "https://github.com/Leslie622/Themd"

const footerLinks = {
  product: [
    { name: "核心功能", href: "#features" },
    { name: "主题工场", href: "#studio" },
    { name: "下载", href: "#download" },
  ],
  help: [
    { name: "常见问题", href: "#faq" },
    { name: "GitHub Issues", href: `${GITHUB_URL}/issues` },
    { name: "GitHub Releases", href: `${GITHUB_URL}/releases` },
  ],
}

export function LandingFooter() {
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
              样式自设的本地 Markdown 笔记本。
              边写边看，不写一行 CSS 定制每一个样式，数据始终在你自己的电脑上。
            </p>
            <div className="flex items-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub 仓库"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="size-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className="font-semibold mb-4">
                {group === "product" ? "产品" : "支持"}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
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
          <p>© 2026 Themd. 保留所有权利。</p>
          <p>
            本站部署于 GitHub Pages，安装包仅通过 GitHub Releases 分发。
          </p>
        </div>
      </div>
    </footer>
  )
}
