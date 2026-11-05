import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CardDecorator } from "@/components/ui/card-decorator"
import { Type, Paintbrush, Shapes, ArrowLeftRight } from "lucide-react"

const values = [
  {
    icon: Type,
    title: "字体与排版",
    description:
      "中西文字体分开选、字号、行高、字间距、段间距、首行缩进、正文最大宽度，标题逐级独立设置。",
  },
  {
    icon: Paintbrush,
    title: "颜色与背景",
    description:
      "文字色、背景色、渐变画布、纸张颜色分开调；加粗还能当高亮笔用，颜色随手改。",
  },
  {
    icon: Shapes,
    title: "块级元素",
    description:
      "引用块、代码块、表格、分割线、图片、提示块——边框、圆角、阴影、斑马纹，每一项都有开关和滑块。",
  },
  {
    icon: ArrowLeftRight,
    title: "导入与分享",
    description:
      "主题包一键导出给朋友，也能直接导入已有的 CSS 主题文件自动映射；改完即生效，毫秒级预览。",
  },
]

export function AboutSection() {
  return (
    <section id="studio" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            主题工场
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            不写一行 CSS，把每个样式改成你想要的样子
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Markdown 里出现的每一种东西——标题、加粗、表格、代码块、图片、提示块——
            在主题工场里都有对应的设置项。三栏布局：左边挑元素，右边调参数，中间实时看效果。
          </p>
        </div>

        {/* Values Grid */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4 mb-12">
          {values.map((value, index) => (
            <Card key={index} className="group shadow-xs py-2">
              <CardHeader className="items-center p-8 text-center">
                <CardDecorator>
                  <value.icon className="size-6" aria-hidden />
                </CardDecorator>
                <CardTitle className="mt-6 text-balance">
                  {value.title}
                </CardTitle>
                <CardDescription className="mt-3">
                  {value.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Highlight points */}
        <div className="mx-auto max-w-3xl text-center mt-16">
          <p className="text-muted-foreground">
            内置「极简」与「GitHub」两套主题打底；
            点选预览里的任意元素可以直接跳到它的设置项；
            还能导入自己的笔记实时预览调参效果。主题只保存差异项，
            换一个笔记、换一台电脑，观感始终如一。
          </p>
        </div>
      </div>
    </section>
  )
}
