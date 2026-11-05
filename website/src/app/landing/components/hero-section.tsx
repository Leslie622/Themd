import { ArrowRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DotPattern } from "@/components/dot-pattern"
import { assetUrl } from "@/lib/utils"

const DOWNLOAD_URL = "https://github.com/Leslie622/Themd/releases"

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-b from-background to-background/80 pt-16 sm:pt-20 pb-16"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" size="md" fadeStyle="ellipse" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <div className="mb-8 flex justify-center">
            <Badge variant="outline" className="px-4 py-2 border-foreground">
              免费 · 本地 · 无广告
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            样式自设的
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {" "}
              本地 Markdown{" "}
            </span>
            笔记本
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            边写边看的实时预览，不写一行 CSS 就能定制每一个样式的主题工场，
            数据全部保存在你自己的电脑上。为 Windows 免费打造。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="text-base cursor-pointer"
              nativeButton={false}
              render={<a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />}
            >
              <Download data-icon="inline-start" />
              免费下载 Windows 版
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base cursor-pointer"
              nativeButton={false}
              render={
                <a href="#features" onClick={(e) => {
                  e.preventDefault()
                  document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" })
                }} />
              }
            >
              了解功能
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>

        {/* Hero Image/Visual */}
        <div className="mx-auto mt-20 max-w-6xl">
          <div className="relative group">
            {/* Top background glow effect - positioned above the image */}
            <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>

            <div className="relative rounded-xl border bg-card shadow-2xl">
              {/* Light mode screenshot */}
              <img
                src={assetUrl("themd-hero-light.webp")}
                alt="Themd 主界面截图（亮色模式）：左侧文件树、中间实时预览编辑区"
                className="w-full rounded-xl object-cover block dark:hidden"
              />

              {/* Dark mode screenshot */}
              <img
                src={assetUrl("themd-hero-dark.webp")}
                alt="Themd 主界面截图（暗色模式）"
                className="w-full rounded-xl object-cover hidden dark:block"
              />

              {/* Bottom fade effect - gradient overlay that fades the image to background */}
              <div className="absolute bottom-0 left-0 w-full h-32 md:h-40 lg:h-48 bg-gradient-to-b from-background/0 via-background/70 to-background rounded-b-xl"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
