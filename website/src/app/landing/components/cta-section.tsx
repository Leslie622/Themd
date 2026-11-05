import { Download } from "lucide-react"
import { Github } from "@/components/icons/brand-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const DOWNLOAD_URL = "https://github.com/Leslie622/Themd/releases"
const GITHUB_URL = "https://github.com/Leslie622/Themd"

export function CTASection() {
  return (
    <section className="py-16 lg:py-24 bg-muted/80">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <div className="flex flex-col gap-8">
              {/* Badge and Stats */}
              <div className="flex flex-col items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-2">
                  免费本地应用
                </Badge>

                <div className="text-muted-foreground flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <div className="size-2 rounded-full bg-success" />
                    无需注册
                  </span>
                  <Separator orientation="vertical" className="h-4! data-vertical:self-center" />
                  <span>离线可用</span>
                  <Separator orientation="vertical" className="h-4! data-vertical:self-center" />
                  <span>数据本地存储</span>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex flex-col gap-6">
                <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  现在，把想法
                  <span className="flex sm:inline-flex justify-center">
                    <span className="relative mx-2">
                      <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        写下来
                      </span>
                      <div className="absolute start-0 -bottom-2 h-1 w-full bg-gradient-to-r from-primary/30 to-primary/10" />
                    </span>
                  </span>
                </h2>

                <p className="text-muted-foreground mx-auto max-w-2xl text-balance lg:text-xl">
                  下载 Themd，打开你的笔记文件夹，
                  让每一篇 Markdown 都以你喜欢的样子呈现。
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col justify-center gap-4 sm:flex-row sm:gap-6">
                <Button
                  size="lg"
                  className="cursor-pointer px-8 py-6 text-lg font-medium"
                  nativeButton={false}
                  render={
                    <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <Download className="size-5" data-icon="inline-start" />
                  免费下载 Windows 版
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="cursor-pointer px-8 py-6 text-lg font-medium group"
                  nativeButton={false}
                  render={
                    <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <Github className="size-5" data-icon="inline-start" />
                  查看 GitHub 仓库
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-success me-1" />
                  <span>免费使用，无功能限制</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-info me-1" />
                  <span>安装包仅来自 GitHub 官方发布页</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-warning me-1" />
                  <span>持续迭代更新</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
