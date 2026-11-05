import {
  Eye,
  Columns2,
  FileText,
  ListTree,
  Save,
  Lightbulb,
  MousePointerClick,
  ArrowLeftRight,
  UserX,
  WifiOff,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

const mainFeatures = [
  {
    icon: Eye,
    title: "实时预览",
    description: "边写边渲染，语法符号自动隐藏，光标所在行露出源码。",
  },
  {
    icon: Columns2,
    title: "分屏模式",
    description: "编辑与预览左右分栏，双向同步滚动，宽度随意拖。",
  },
  {
    icon: ListTree,
    title: "大纲导航",
    description: "右侧目录随滚动高亮当前章节，点击即达。",
  },
  {
    icon: Save,
    title: "自动保存",
    description: "停止输入即写回磁盘，Ctrl+S 立即保存，关窗不丢稿。",
  },
]

const secondaryFeatures = [
  {
    icon: Lightbulb,
    title: "公式与图表",
    description: "数学公式、Mermaid 流程图、代码高亮，写技术笔记不发愁。",
  },
  {
    icon: MousePointerClick,
    title: "点选直达",
    description: "在预览里点任意元素，直接跳到它对应的设置项。",
  },
  {
    icon: ArrowLeftRight,
    title: "主题互通",
    description: "导入 CSS 主题自动映射；导出样式包在别处粘贴即复现。",
  },
  {
    icon: FileText,
    title: "导出三格式",
    description: "Markdown / 独立 HTML / PDF 一键导出，分享无门槛。",
  },
]

const localBadges = [
  {
    icon: UserX,
    title: "无需注册",
    description: "没有账号体系，打开即用，不存在「上传到云端」这一步。",
  },
  {
    icon: WifiOff,
    title: "离线可用",
    description: "数据与功能全在本地，断网照常写作，飞机上也不误事。",
  },
  {
    icon: Trash2,
    title: "删除可恢复",
    description: "笔记删除进系统回收站，误删可以从容找回。",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            核心功能
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            写作专注，样式随心，数据在你手里
          </h2>
          <p className="text-lg text-muted-foreground">
            三种编辑视图适应不同场景；主题工场负责美观；本地优先的设计让你的笔记只属于你。
          </p>
        </div>

        {/* First Feature Section */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Content */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                三种视图，一种心流
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                实时预览像纸一样干净，分屏模式看得见源码与效果的对应，
                纯编辑模式保留纯粹的文字节奏。任何时候一键切换，位置与偏好自动记忆。
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {mainFeatures.map((feature, index) => (
                <li
                  key={index}
                  className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors"
                >
                  <div className="mt-0.5 flex shrink-0 items-center justify-center">
                    <feature.icon
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {feature.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Image */}
          <div className="relative rounded-xl border bg-card shadow-lg overflow-hidden">
            <img
              src="./themd-feature-editor.webp"
              alt="Themd 编辑界面：分屏模式与大纲导航"
              className="w-full object-cover block dark:hidden"
              loading="lazy"
            />
            <img
              src="./themd-feature-editor-dark.webp"
              alt="Themd 编辑界面（暗色）"
              className="w-full object-cover hidden dark:block"
              loading="lazy"
            />
          </div>
        </div>

        {/* Second Feature Section - Flipped Layout */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Image */}
          <div className="relative rounded-xl border bg-card shadow-lg overflow-hidden order-2 lg:order-1">
            <img
              src="./themd-feature-studio.webp"
              alt="Themd 主题工场：三栏布局实时调参"
              className="w-full object-cover block dark:hidden"
              loading="lazy"
            />
            <img
              src="./themd-feature-studio-dark.webp"
              alt="Themd 主题工场（暗色）"
              className="w-full object-cover hidden dark:block"
              loading="lazy"
            />
          </div>

          {/* Right Content */}
          <div className="flex flex-col gap-6 order-1 lg:order-2">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                主题工场：所见即所得的样式定制
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                三栏布局：左侧挑元素、右侧调参数、中间实时看效果。
                不懂 CSS 也能把标题、表格、代码块一个个调成心仪的样子。
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {secondaryFeatures.map((feature, index) => (
                <li
                  key={index}
                  className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors"
                >
                  <div className="mt-0.5 flex shrink-0 items-center justify-center">
                    <feature.icon
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {feature.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Local-first strip */}
        <div className="grid gap-6 sm:grid-cols-3">
          {localBadges.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-xl border bg-card p-6"
            >
              <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                <item.icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{item.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
