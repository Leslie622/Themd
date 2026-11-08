export type Lang = "zh" | "en"

/**
 * 中文基准字典。en 必须与之同构（type Dict 约束），
 * 新增文案先写 zh 再补 en，否则 tsc 报错。
 */
const zh = {
  common: {
    home: "Themd 首页",
    githubRepo: "GitHub 仓库",
    openMenu: "打开菜单",
    langToggle: "切换到 English",
    close: "关闭",
    lightboxHint: "点击图片在适应窗口与原图大小间切换，Esc 关闭",
    toggleToLight: "切换到亮色模式",
    toggleToDark: "切换到暗色模式",
  },
  nav: {
    items: [
      { name: "功能", href: "#features" },
      { name: "主题工场", href: "#studio" },
      { name: "下载", href: "#download" },
      { name: "常见问题", href: "#faq" },
    ],
    download: "下载",
    downloadWindows: "下载 Windows 版",
  },
  hero: {
    titlePre: "样式自设的",
    titleAccent: "本地 Markdown",
    titlePost: "笔记本",
    subtitle:
      "边写边看的实时预览，不写一行 CSS 就能定制每一个样式的主题工场，数据全部保存在你自己的电脑上。为 Windows 免费打造。",
    download: "下载 Windows 版",
    explore: "了解功能",
    prevImage: "上一张截图",
    nextImage: "下一张截图",
    altLight: "Themd 实时预览视图：标题、行内元素与五色提示块",
    altLists: "Themd 实时预览视图：任务列表与表格",
    altCode: "Themd 实时预览视图：代码块、数学公式与 Mermaid 图表",
  },
  features: {
    title: "写作专注，样式随心，数据在你手里",
    subtitle:
      "三种编辑视图适应不同场景；主题工场负责美观；本地优先的设计让你的笔记只属于你。",
    viewsTitle: "三种视图，一种心流",
    viewsDescription:
      "实时预览像纸一样干净，分屏模式看得见源码与效果的对应，纯编辑模式保留纯粹的文字节奏。任何时候一键切换，位置与偏好自动记忆。",
    mainFeatures: [
      {
        title: "实时预览",
        description: "边写边渲染，语法符号自动隐藏，光标所在行露出源码。",
      },
      {
        title: "分屏模式",
        description: "编辑与预览左右分栏，双向同步滚动，宽度随意拖。",
      },
      {
        title: "大纲导航",
        description: "右侧目录随滚动高亮当前章节，点击即达。",
      },
      {
        title: "自动保存",
        description: "停止输入即写回磁盘，Ctrl+S 立即保存，关窗不丢稿。",
      },
      {
        title: "标题即搜",
        description: "侧栏输入即出结果，按标题全库匹配，笔记再多也能一步到位。",
      },
      {
        title: "图片与图床",
        description:
          "粘贴、拖拽即可插图：本地归档、图床外链、内嵌单文件三种归宿；预览点击即全屏灯箱，缩放旋转下载样样都有。",
      },
    ],
    studioTitle: "主题工场：所见即所得的样式定制",
    studioDescription:
      "三栏布局：左侧挑元素、右侧调参数、中间实时看效果。不懂 CSS 也能把标题、表格、代码块一个个调成心仪的样子。",
    secondaryFeatures: [
      {
        title: "公式与图表",
        description: "数学公式、Mermaid 流程图、代码高亮，写技术笔记不发愁。",
      },
      {
        title: "点选直达",
        description: "在预览里点任意元素，直接跳到它对应的设置项。",
      },
      {
        title: "主题互通",
        description: "导入 CSS 主题自动映射；导出样式包在别处粘贴即复现。",
      },
      {
        title: "导出三格式",
        description: "Markdown / 独立 HTML / PDF 一键导出，分享无门槛。",
      },
    ],
    localBadges: [
      {
        title: "无需注册",
        description: "没有账号体系，打开即用，不存在「上传到云端」这一步。",
      },
      {
        title: "离线可用",
        description: "数据与功能全在本地，断网照常写作，飞机上也不误事。",
      },
      {
        title: "删除可恢复",
        description: "笔记删除进系统回收站，误删可以从容找回。",
      },
    ],
    exportTitle: "发出去才有讲究：三种格式，各自保真",
    exportDescription:
      "Markdown 原样带走，独立 HTML 双击即开，PDF 版式定格——三种格式全部跟随当前主题样式，导出即所见。",
    exportFormats: ["Markdown", "独立 HTML", "PDF"],
    lightboxTitle: "图片灯箱：点开才看得清",
    lightboxDescription:
      "预览里点击任意图片全屏打开：滚轮无级缩放、一键旋转与下载，同一篇的多张图左右切换。",
    lightboxFeatures: ["滚轮缩放", "旋转", "下载", "多图切换"],
    uploaderTitle: "图床直传：截图粘贴即上线",
    uploaderDescription:
      "设置里配好 GitHub 仓库或 PicGo，粘贴的图片自动压缩上传拿外链；凭据只存本机，Typora 用户零上手。",
    uploaderChips: ["GitHub 直传", "PicGo", "WebP 压缩", "凭据仅存本机"],
    altEditor: "Themd 编辑界面：分屏模式与大纲导航",
    altStudio: "Themd 主题工场：三栏布局实时调参",
    altExport: "Themd 导出效果：主题化 PDF 与独立 HTML",
    altLightbox: "Themd 图片灯箱：全屏缩放与工具栏",
    altUploader: "Themd 图床配置：GitHub 仓库与 PicGo",
  },
  stats: {
    items: [
      {
        value: "3 种",
        label: "编辑视图",
        description: "实时预览 · 分屏 · 纯编辑",
      },
      {
        value: "100+",
        label: "可定制样式项",
        description: "字体颜色间距逐项设置",
      },
      {
        value: "3 种",
        label: "导出格式",
        description: "Markdown · HTML · PDF",
      },
      {
        value: "100%",
        label: "数据本地存储",
        description: "无需注册 · 离线可用",
      },
    ],
  },
  about: {
    title: "不写一行 CSS，把每个样式改成你想要的样子",
    subtitle:
      "Markdown 里出现的每一种东西——标题、加粗、表格、代码块、图片、提示块——在主题工场里都有对应的设置项。三栏布局：左边挑元素，右边调参数，中间实时看效果。",
    values: [
      {
        title: "字体与排版",
        description:
          "中西文字体分开选、字号、行高、字间距、段间距、首行缩进、正文最大宽度，标题逐级独立设置。",
      },
      {
        title: "颜色与背景",
        description:
          "文字色、背景色、渐变画布、纸张颜色分开调；加粗还能当高亮笔用，颜色随手改。",
      },
      {
        title: "块级元素",
        description:
          "引用块、代码块、表格、分割线、图片、提示块——边框、圆角、阴影、斑马纹，每一项都有开关和滑块。",
      },
      {
        title: "导入与分享",
        description:
          "主题包一键导出给朋友，也能直接导入已有的 CSS 主题文件自动映射；改完即生效，毫秒级预览。",
      },
    ],
    highlight:
      "内置「极简」与「GitHub」两套主题打底，暗色套与附加 CSS 一并配置；点选预览里的任意元素可以直接跳到它的设置项；还能导入自己的笔记实时预览调参效果。主题只保存差异项，换一个笔记、换一台电脑，观感始终如一。",
  },
  download: {
    title: "下载，即刻开写",
    security: "安装包仅来自 GitHub Releases 页面，别处下载的请勿信任。",
    cardTitle: "Windows 版",
    cardRequirement: "适用于 Windows 10 / 11（64 位）",
    cardInfo: "免费使用 · 安装包约 10 MB · 无捆绑无广告",
    cardAction: "前往 GitHub Releases 下载",
    planned: "规划中",
    feedbackPre: "有问题或建议？欢迎到 ",
    feedbackPost: " 反馈",
  },
  faq: {
    title: "你可能想知道",
    subtitle: "关于下载、数据安全与主题定制的问题都在这里。",
    items: [
      {
        question: "Themd 是免费的吗？",
        answer:
          "是，Themd 完全免费使用，没有功能限制、没有订阅、没有广告，也不需要注册任何账号。",
      },
      {
        question: "我的笔记数据存在哪里？",
        answer:
          "全部保存在你自己的电脑磁盘上，就是普通的 Markdown 文件和图片文件，任何编辑器都能打开。Themd 不上传、不联网同步，卸载应用也不会丢失任何数据。",
      },
      {
        question: "支持哪些系统？",
        answer:
          "目前提供 Windows 版本（Windows 10 / 11，64 位）。macOS 和 Linux 版本在规划中。",
      },
      {
        question: "我已有一堆 Markdown 文件，能直接用吗？",
        answer:
          "能。把文件夹用 Themd 打开即可，目录树实时镜像磁盘上的文件结构；在外部新建、重命名、删除文件，Themd 会自动跟着更新。已有的图片文件夹、嵌套目录都不需要任何转换。",
      },
      {
        question: "支持数学公式、流程图和代码高亮吗？",
        answer:
          "支持。数学公式、Mermaid 流程图与时序图、五类提示块（Note / Tip / Important / Warning / Caution）、主流语言代码高亮都是内置能力，写技术文档不用装任何插件。",
      },
      {
        question: "不会 CSS，能自己换主题吗？",
        answer:
          "能，这正是主题工场存在的意义。内置「极简」和「GitHub」两套主题可以直接用；想微调时，打开主题工场，点击预览里的任意元素就能找到它的设置项——颜色、字体、圆角、间距，全部是可视化控件，改完立即生效。也可以直接导入别人分享的主题包或 CSS 文件。",
      },
    ],
    moreText: "还有其他问题？欢迎到 GitHub Issues 提问。",
    actionText: "前往 Issues 反馈",
  },
  cta: {
    statusWords: ["无需注册", "离线可用", "数据本地存储"],
    titlePre: "现在，把想法",
    titleAccent: "写下来",
    subtitle:
      "下载 Themd，打开你的笔记文件夹，让每一篇 Markdown 都以你喜欢的样子呈现。",
    download: "下载 Windows 版",
    github: "查看 GitHub 仓库",
    trust: [
      "免费使用，无功能限制",
      "安装包仅来自 GitHub 官方发布页",
      "持续迭代更新",
    ],
  },
  footer: {
    description:
      "样式自设的本地 Markdown 笔记本。边写边看，不写一行 CSS 定制每一个样式，数据始终在你自己的电脑上。",
    columns: [
      {
        title: "产品",
        links: [
          { name: "核心功能", href: "#features" },
          { name: "主题工场", href: "#studio" },
          { name: "下载", href: "#download" },
        ],
      },
      {
        title: "支持",
        links: [
          { name: "常见问题", href: "#faq" },
          { name: "GitHub Issues", href: "https://github.com/Leslie622/Themd/issues" },
          { name: "GitHub Releases", href: "https://github.com/Leslie622/Themd/releases" },
        ],
      },
    ],
    copyright: "© 2026 Themd. 保留所有权利。",
    deployment: "本站部署于 GitHub Pages，安装包仅通过 GitHub Releases 分发。",
  },
  share: {
    title: "你的样式，不止在 Themd 里",
    subtitle:
      "主题工场调好的观感，两种方式带走：主题包分享给朋友，可移植样式包贴进别的编辑器。",
    packTitle: "主题包：一键分享",
    packDescription:
      "导出 .themd.json——只存令牌差异与附加 CSS，文件小到随手发。对方导入即用，观感与你这边完全一致。",
    portableTitle: "可移植样式包：贴进别的编辑器",
    portableDescription:
      "完整 CSS + 当前主题令牌内联，选择器已按目标端改写——贴过去即复现 Themd 预览观感，令牌缺失处回落「极简」打底。",
    targets: [
      {
        name: "Typora",
        description: "放进主题文件夹，重启后在主题菜单直接选它。",
      },
      {
        name: "VSCode",
        description: "markdown.styles 一行配置，预览即刻换装。",
      },
      {
        name: "GitHub",
        description: "覆盖 markdown-body，配合样式扩展即可生效。",
      },
      {
        name: "自建站点",
        description: "通用 .portable.css，博客与文档站直接引入。",
      },
    ],
    strip: ["暗色套随系统自动切换", "画布背景整页生效", "只保存差异项，换机如一"],
  },
}

const en: typeof zh = {
  common: {
    home: "Themd home",
    githubRepo: "GitHub repository",
    openMenu: "Open menu",
    langToggle: "切换到中文",
    close: "Close",
    lightboxHint: "Click the image to toggle between fit and full size; press Esc to close",
    toggleToLight: "Switch to light mode",
    toggleToDark: "Switch to dark mode",
  },
  nav: {
    items: [
      { name: "Features", href: "#features" },
      { name: "Theme studio", href: "#studio" },
      { name: "Download", href: "#download" },
      { name: "FAQ", href: "#faq" },
    ],
    download: "Download",
    downloadWindows: "Download for Windows",
  },
  hero: {
    titlePre: "The local",
    titleAccent: "Markdown",
    titlePost: "notebook — styled your way",
    subtitle:
      "Real-time preview as you type, a theme studio that customizes every style without a line of CSS, and all data stored on your own computer. Built for Windows.",
    download: "Download for Windows",
    explore: "Explore features",
    prevImage: "Previous screenshot",
    nextImage: "Next screenshot",
    altLight:
      "Themd live preview view: headings, inline elements and five colored callouts",
    altLists: "Themd live preview view: task lists and tables",
    altCode: "Themd live preview view: code blocks, math formulas and Mermaid diagrams",
  },
  features: {
    title: "Focus on writing, style it your way, own your data",
    subtitle:
      "Three editing views for different scenarios; the theme studio handles the looks; local-first design keeps your notes yours.",
    viewsTitle: "Three views, one flow",
    viewsDescription:
      "Live preview is clean as paper, split view shows source and result side by side, and the plain editor keeps a pure writing rhythm. Switch anytime — layout and preferences are remembered.",
    mainFeatures: [
      {
        title: "Live preview",
        description:
          "Rendered as you type, syntax marks auto-hidden, source revealed on the cursor line.",
      },
      {
        title: "Split view",
        description:
          "Editor and preview side by side with synced two-way scrolling; drag the width freely.",
      },
      {
        title: "Outline",
        description:
          "The TOC on the right highlights the current section as you scroll; click to jump.",
      },
      {
        title: "Autosave",
        description:
          "Writes back to disk when you stop typing; Ctrl+S saves instantly; close the window without losing a word.",
      },
      {
        title: "Instant title search",
        description:
          "Type in the sidebar to filter every note by title — hundreds of notes, one step away.",
      },
      {
        title: "Images & image beds",
        description:
          "Paste or drag to insert: archive locally, upload to an image bed, or embed inline — plus a full-screen lightbox with zoom, rotate and download.",
      },
    ],
    studioTitle: "Theme studio: WYSIWYG style customization",
    studioDescription:
      "Three-pane layout: pick elements on the left, tweak values on the right, watch the preview in the middle. Style headings, tables and code blocks one by one — no CSS required.",
    secondaryFeatures: [
      {
        title: "Formulas & diagrams",
        description:
          "Math formulas, Mermaid flowcharts and code highlighting — technical notes without the hassle.",
      },
      {
        title: "Click-through",
        description:
          "Click any element in the preview to jump straight to its settings.",
      },
      {
        title: "Theme interop",
        description:
          "Import CSS themes with automatic mapping; export a style pack and paste it anywhere to reproduce the look.",
      },
      {
        title: "Three export formats",
        description:
          "Export as Markdown / standalone HTML / PDF in one click — sharing made easy.",
      },
    ],
    localBadges: [
      {
        title: "No sign-up",
        description:
          "No account system — open and write. There is simply no \"upload to cloud\" step.",
      },
      {
        title: "Works offline",
        description:
          "Data and features are all local; keep writing even on a plane.",
      },
      {
        title: "Recoverable deletes",
        description:
          "Deleted notes go to the system recycle bin — mistakes are recoverable.",
      },
    ],
    exportTitle: "Sharing is part of writing: three formats, each faithful",
    exportDescription:
      "Take Markdown as-is, open the standalone HTML with a double-click, pin the layout as PDF — all three follow your current theme, exported exactly as seen.",
    exportFormats: ["Markdown", "Standalone HTML", "PDF"],
    lightboxTitle: "Image lightbox: open it to see the details",
    lightboxDescription:
      "Click any image in the preview to open it fullscreen: smooth wheel zoom, one-click rotate and download, and flick through every image in the note.",
    lightboxFeatures: ["Wheel zoom", "Rotate", "Download", "Multi-image"],
    uploaderTitle: "Image beds: paste now, online instantly",
    uploaderDescription:
      "Configure a GitHub repo or PicGo in settings, and pasted images are compressed and uploaded for external links automatically. Credentials stay on your machine — zero learning curve for Typora users.",
    uploaderChips: ["GitHub direct", "PicGo", "WebP compression", "Local-only credentials"],
    altEditor: "Themd editing interface: split view with outline navigation",
    altStudio: "Themd theme studio: three-pane live tuning",
    altExport: "Themd export result: themed PDF and standalone HTML",
    altLightbox: "Themd image lightbox: fullscreen zoom and toolbar",
    altUploader: "Themd image bed settings: GitHub repository and PicGo",
  },
  stats: {
    items: [
      {
        value: "3",
        label: "Editing views",
        description: "Live preview · Split · Editor only",
      },
      {
        value: "100+",
        label: "Styleable options",
        description: "Fonts, colors and spacing, item by item",
      },
      {
        value: "3",
        label: "Export formats",
        description: "Markdown · HTML · PDF",
      },
      {
        value: "100%",
        label: "Local storage",
        description: "No sign-up · Offline ready",
      },
    ],
  },
  about: {
    title: "Every style, exactly how you want it — without a line of CSS",
    subtitle:
      "Everything that appears in Markdown — headings, bold, tables, code blocks, images, callouts — has its own settings in the theme studio. Three panes: pick an element on the left, adjust values on the right, watch it change live in the middle.",
    values: [
      {
        title: "Fonts & typography",
        description:
          "Separate fonts for CJK and Latin, font size, line height, letter spacing, paragraph spacing, first-line indent, max content width — headings set per level.",
      },
      {
        title: "Colors & backgrounds",
        description:
          "Text color, background color, gradient canvas and paper color tuned separately; bold doubles as a highlighter, colors change on a whim.",
      },
      {
        title: "Block elements",
        description:
          "Quotes, code blocks, tables, dividers, images, callouts — border, radius, shadow, zebra stripes, each with its own switch and slider.",
      },
      {
        title: "Import & share",
        description:
          "Export a theme pack to share with friends, or import an existing CSS theme with automatic mapping. Changes apply instantly with millisecond previews.",
      },
    ],
    highlight:
      "Two built-in themes — Minimal and GitHub — as your starting point, with dark-mode token sets and extra custom CSS included. Click any element in the preview to jump to its settings, and import your own notes to see tweaks live. Themes store only the differences, so the look stays consistent across notes and machines.",
  },
  download: {
    title: "Download and start writing",
    security:
      "Installers come only from the GitHub Releases page — don't trust downloads from anywhere else.",
    cardTitle: "Windows",
    cardRequirement: "For Windows 10 / 11 (64-bit)",
    cardInfo: "Free to use · ~10 MB installer · No bundleware or ads",
    cardAction: "Download from GitHub Releases",
    planned: "Planned",
    feedbackPre: "Questions or suggestions? Reach us on ",
    feedbackPost: "",
  },
  faq: {
    title: "Frequently asked questions",
    subtitle: "Downloads, data safety and theme customization — answered here.",
    items: [
      {
        question: "Is Themd free?",
        answer:
          "Yes. Themd is completely free — no feature limits, no subscription, no ads, and no account required.",
      },
      {
        question: "Where is my note data stored?",
        answer:
          "Everything lives on your own disk, as plain Markdown and image files that any editor can open. Themd never uploads or syncs over the network, and uninstalling the app loses nothing.",
      },
      {
        question: "Which platforms are supported?",
        answer:
          "Windows is available today (Windows 10 / 11, 64-bit). macOS and Linux are planned.",
      },
      {
        question:
          "I already have a pile of Markdown files — can I use them directly?",
        answer:
          "Yes. Open the folder in Themd and the tree mirrors your disk in real time; files created, renamed or deleted outside the app are picked up automatically. Existing image folders and nested directories need no conversion.",
      },
      {
        question:
          "Are math formulas, flowcharts and code highlighting supported?",
        answer:
          "Yes. Math formulas, Mermaid flowcharts and sequence diagrams, five callout types (note, tip, important, warning, caution), and syntax highlighting for mainstream languages are built in — no plugins needed for technical docs.",
      },
      {
        question: "Can I theme it myself without knowing CSS?",
        answer:
          "Yes — that's what the theme studio is for. Two built-in themes (Minimal and GitHub) work out of the box. To fine-tune, open the studio and click any element in the preview to find its settings — color, font, radius, spacing, all visual controls, applying instantly. You can also import theme packs or CSS files shared by others.",
      },
    ],
    moreText: "Still have questions? Ask on GitHub Issues.",
    actionText: "Give feedback on Issues",
  },
  cta: {
    statusWords: ["No sign-up", "Offline ready", "Local storage"],
    titlePre: "Now, put your ideas",
    titleAccent: "on the page",
    subtitle:
      "Download Themd, open your notes folder, and let every Markdown file look the way you love.",
    download: "Download for Windows",
    github: "View on GitHub",
    trust: [
      "Free to use with no feature limits",
      "Installers only from the official GitHub releases",
      "Constantly improving",
    ],
  },
  footer: {
    description:
      "The local Markdown notebook you can style your way. Write with a live preview, customize every style without CSS, and keep your data on your own computer.",
    columns: [
      {
        title: "Product",
        links: [
          { name: "Features", href: "#features" },
          { name: "Theme studio", href: "#studio" },
          { name: "Download", href: "#download" },
        ],
      },
      {
        title: "Support",
        links: [
          { name: "FAQ", href: "#faq" },
          { name: "GitHub Issues", href: "https://github.com/Leslie622/Themd/issues" },
          { name: "GitHub Releases", href: "https://github.com/Leslie622/Themd/releases" },
        ],
      },
    ],
    copyright: "© 2026 Themd. All rights reserved.",
    deployment:
      "Hosted on GitHub Pages. Installers are distributed only via GitHub Releases.",
  },
  share: {
    title: "Your style, everywhere — not just in Themd",
    subtitle:
      "Two ways to take your theme with you: share it as a theme pack, or paste a portable style pack into other editors.",
    packTitle: "Theme pack: share in one click",
    packDescription:
      "Exports a .themd.json that stores only token differences and extra CSS — small enough to send casually. Friends import it and get exactly your look.",
    portableTitle: "Portable style pack: paste into other editors",
    portableDescription:
      "Full CSS with your tokens inlined, selectors rewritten per target — paste it and the Themd look is reproduced, with Minimal as the fallback where tokens are absent.",
    targets: [
      {
        name: "Typora",
        description:
          "Drop it into the themes folder; it appears in Typora's theme menu after a restart.",
      },
      {
        name: "VSCode",
        description:
          "One line in markdown.styles and the preview is dressed instantly.",
      },
      {
        name: "GitHub",
        description:
          "Targets markdown-body — works with any user style extension.",
      },
      {
        name: "Your own site",
        description:
          "The universal .portable.css drops straight into blogs and docs.",
      },
    ],
    strip: [
      "Dark set follows the system automatically",
      "Canvas background applies to the whole page",
      "Only differences stored — consistent across machines",
    ],
  },
}

export type Dict = typeof zh

export const dictionaries: Record<Lang, Dict> = { zh, en }
