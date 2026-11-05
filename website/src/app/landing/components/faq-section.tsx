import { CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

type FaqItem = {
  value: string
  question: string
  answer: string
}

const faqItems: FaqItem[] = [
  {
    value: "item-1",
    question: "Themd 是免费的吗？",
    answer:
      "是，Themd 完全免费使用，没有功能限制、没有订阅、没有广告，也不需要注册任何账号。",
  },
  {
    value: "item-2",
    question: "我的笔记数据存在哪里？",
    answer:
      "全部保存在你自己的电脑磁盘上，就是普通的 Markdown 文件和图片文件，任何编辑器都能打开。Themd 不上传、不联网同步，卸载应用也不会丢失任何数据。",
  },
  {
    value: "item-3",
    question: "支持哪些系统？",
    answer:
      "目前提供 Windows 版本（Windows 10 / 11，64 位）。macOS 和 Linux 版本在规划中。",
  },
  {
    value: "item-4",
    question: "我已有一堆 Markdown 文件，能直接用吗？",
    answer:
      "能。把文件夹用 Themd 打开即可，目录树实时镜像磁盘上的文件结构；在外部新建、重命名、删除文件，Themd 会自动跟着更新。已有的图片文件夹、嵌套目录都不需要任何转换。",
  },
  {
    value: "item-5",
    question: "支持数学公式、流程图和代码高亮吗？",
    answer:
      "支持。数学公式、Mermaid 流程图与时序图、五大类提示块（提示/摘要/注意/小心/危险）、主流语言代码高亮都是内置能力，写技术文档不用装任何插件。",
  },
  {
    value: "item-6",
    question: "不会 CSS，能自己换主题吗？",
    answer:
      "能，这正是主题工场存在的意义。内置「极简」和「GitHub」两套主题可以直接用；想微调时，打开主题工场，点击预览里的任意元素就能找到它的设置项——颜色、字体、圆角、间距，全部是可视化控件，改完立即生效。也可以直接导入别人分享的主题包或 CSS 文件。",
  },
]

const FaqSection = () => {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            常见问题
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            你可能想知道
          </h2>
          <p className="text-lg text-muted-foreground">
            关于下载、数据安全与主题定制的问题都在这里。
          </p>
        </div>

        {/* FAQ Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-transparent">
            <div className="p-0">
              <Accordion className="gap-5">
                {faqItems.map((item) => (
                  <AccordionItem
                    key={item.value}
                    value={item.value}
                    className="rounded-md border! bg-transparent"
                  >
                    <AccordionTrigger className="cursor-pointer items-center gap-4 rounded-none bg-transparent py-2 ps-3 pe-4 hover:no-underline data-panel-open:border-b">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                          <CircleHelp className="size-5" />
                        </div>
                        <span className="text-start font-semibold">
                          {item.question}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-transparent">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          {/* Contact Support CTA */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              还有其他问题？欢迎到 GitHub Issues 提问。
            </p>
            <Button
              className="cursor-pointer"
              nativeButton={false}
              render={
                <a
                  href="https://github.com/Leslie622/Themd/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              前往 Issues 反馈
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export { FaqSection }
