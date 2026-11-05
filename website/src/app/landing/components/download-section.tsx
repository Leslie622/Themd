import { Download, Apple, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DotPattern } from "@/components/dot-pattern"

const GITHUB_URL = "https://github.com/Leslie622/Themd"
const DOWNLOAD_URL = "https://github.com/Leslie622/Themd/releases"

export function DownloadSection() {
  return (
    <section id="download" className="py-24 sm:py-32 relative">
      <div className="absolute inset-0">
        <DotPattern className="opacity-75" size="md" fadeStyle="ellipse" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <Badge variant="outline" className="mb-4">
            下载
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            免费下载，即刻开写
          </h2>
          <p className="text-lg text-muted-foreground">
            安装包仅来自 GitHub Releases 页面，别处下载的请勿信任。
          </p>
        </div>

        {/* Windows primary card */}
        <Card className="mx-auto max-w-xl shadow-lg border-primary/30">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 w-fit p-4 bg-primary/10 rounded-2xl">
              <Download className="size-10 text-primary" aria-hidden="true" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Windows 版</h3>
            <p className="text-muted-foreground mb-2">
              适用于 Windows 10 / 11（64 位）
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              免费使用 · 安装包约 10 MB · 无捆绑无广告
            </p>
            <Button
              size="lg"
              className="w-full text-base cursor-pointer"
              nativeButton={false}
              render={<a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />}
            >
              <Download data-icon="inline-start" />
              前往 GitHub Releases 下载
            </Button>
          </CardContent>
        </Card>

        {/* Other platforms - planned */}
        <div className="mx-auto max-w-xl mt-6 grid grid-cols-2 gap-4">
          <Card className="opacity-60">
            <CardContent className="p-5 flex items-center gap-3">
              <Apple className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground text-sm">macOS 版</p>
                <p className="text-xs text-muted-foreground">规划中</p>
              </div>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardContent className="p-5 flex items-center gap-3">
              <Terminal className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground text-sm">Linux 版</p>
                <p className="text-xs text-muted-foreground">规划中</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          有问题或建议？欢迎到{" "}
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            GitHub Issues
          </a>{" "}
          反馈
        </p>
      </div>
    </section>
  )
}
