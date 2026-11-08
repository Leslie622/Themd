import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Github } from "@/components/icons/brand-icons"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
} from "@/components/ui/sheet"
import { ThemdLogo } from "@/components/ThemdLogo"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { useLang } from "@/lib/i18n/i18n-context"

const GITHUB_URL = "https://github.com/Leslie622/Themd"
const DOWNLOAD_URL = "https://github.com/Leslie622/Themd/releases"

// Smooth scroll function
const smoothScrollTo = (targetId: string) => {
  if (targetId.startsWith("#")) {
    const element = document.querySelector(targetId)
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }
}

function GithubButton({ className }: { className?: string }) {
  const { t } = useLang()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      nativeButton={false}
      render={
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label={t.common.githubRepo} />
      }
    >
      <Github className="size-5" />
    </Button>
  )
}

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useLang()
  const navigationItems = t.nav.items

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        {/* Left: Logo + Navigation */}
        <div className="flex items-center gap-2 md:gap-8">
          <div className="flex items-center gap-2">
            <a
              href="#hero"
              className="flex items-center gap-2 cursor-pointer"
              aria-label={t.common.home}
            >
              <ThemdLogo className="h-7 w-auto" />
            </a>
          </div>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="flex-none justify-start">
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.name}>
                  <NavigationMenuLink
                    href={item.href}
                    className="group inline-flex h-10 w-max items-center justify-center px-4 py-2 text-sm font-medium transition-colors hover:text-primary focus:text-primary focus:outline-none cursor-pointer"
                  >
                    {item.name}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          <LanguageToggle variant="ghost" />
          <ModeToggle variant="ghost" />
          <GithubButton />
          <Button
            className="cursor-pointer"
            nativeButton={false}
            render={
              <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />
            }
          >
            {t.nav.download}
          </Button>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger
            className="md:hidden"
            render={
              <Button variant="ghost" size="icon" className="cursor-pointer" />
            }
          >
            <Menu className="size-5" />
            <span className="sr-only">{t.common.openMenu}</span>
          </SheetTrigger>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-full sm:w-[400px] p-0 gap-0 overflow-hidden flex flex-col"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <SheetHeader className="gap-0 p-4 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <ThemdLogo className="h-6 w-auto" />
                  <div className="ml-auto flex items-center gap-2">
                    <LanguageToggle variant="ghost" />
                    <ModeToggle variant="ghost" />
                    <GithubButton />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      className="cursor-pointer size-8"
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Navigation Links */}
              <div className="flex-1 overflow-y-auto">
                <nav className="flex flex-col p-6 gap-1">
                  {navigationItems.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className="flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      onClick={(e) => {
                        setIsOpen(false)
                        e.preventDefault()
                        setTimeout(() => smoothScrollTo(item.href), 100)
                      }}
                    >
                      {item.name}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-col border-t p-6 gap-4">
                <Button
                  size="lg"
                  className="w-full cursor-pointer"
                  nativeButton={false}
                  render={
                    <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  {t.nav.downloadWindows}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
