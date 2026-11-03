/**
 * 示例图片(480×120 灰底占位 PNG)。
 * 注意 markdown-it 默认只放行 gif/png/jpeg/webp 的 data: 链接,
 * svg data URL 会被当纯文本渲染,所以这里用 base64 PNG。
 */
export const SAMPLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAeAAAAB4CAIAAACl9LZYAAABcklEQVR42u3UMQ0AIBAEwfevgQ4Br+pDgQlUkFwxySjYYmvtBiBQSQAQPeg5F4AQBg1g0AAYNIBBA2DQAAYNgEEDYNAABg2AQQMYNAAGDYBBAxg0AAYNYNAAGDSAQcsBYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg1g0AYNYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg1g0AYNYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0gEErAmDQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNYNAGDWDQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNYNAGDWDQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNYNAGDWDQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNgEEDGDQABg1g0AAYNIBBKwJg0AAYNIBBA2DQAAYNgEEDYNAABg2AQQMYNAAGDWDQBg1g0AAYNIBBA/Bz0ACkMWiAUA9iFKqGFeC1mwAAAABJRU5ErkJggg=='

/**
 * 元素级专注样例:中栏「专注样例」模式只渲染当前选中元素对应的一段 md,
 * 且刻意给足上下文——调下划线给一整段完整文本、调段落给连续几段,
 * 让样式改动有真实语境可对照,而不是孤零零一个元素。
 * 文案用全角中文标点(样例本身就是排版示范);key 与 elements.ts 的 ElementDef.id 对应;
 * 模板字符串内 ` 与 ${ 必须转义。
 */
export const FOCUSED_SAMPLES: Record<string, string> = {
  root: `正文是一篇文档的基础：字体、字号、行高、字间距与颜色在这里统一定义，所有未单独定制的元素都会继承它们。

Themd 把这些排印参数做成令牌，你在右侧调整的每一项都会实时反映到这片预览区。先定好正文的气质，再逐个打磨标题、引用与代码块，是给主题打底的推荐顺序。

预览区是画布，正文是铺在上面的一页纸：给纸换底色用「纸张颜色」，给整个画布铺底用「画布背景」——支持纯色、渐变，也可以点图片按钮内嵌一张本机图片当壁纸。

调大行高能让长文更透气，收窄页宽则更像一本书。慢慢来，这片预览会一直陪着你。`,
  p: `这是一个普通段落。段间距决定段落之间的呼吸感，首行缩进则是中文排版的经典手法——两项都可以在右侧随时调整。

这是第二个段落，用来观察相邻两段之间的疏密关系。段间距调大，段落会像散文一样舒展；收小之后，则更接近紧凑的技术文档。

第三个段落用来验证对齐方式。切换到「两端对齐」后，这一段的右边缘会被拉齐，像报纸版面一样整齐。

最后一个段落。把首行缩进调成 2em，每段开头都会空出两个汉字的宽度。`,
  heading: `# 一级标题

标题下方紧跟一段正文，段前/段后间距在这里最直观。

## 二级标题

共用令牌控制所有层级的字体、字重、行高与颜色。

### 三级标题

各级字号在左侧单独的 H1–H6 里设置。

#### 四级标题

##### 五级标题

###### 六级标题`,
  h1: `# 一级标题：文档的门面

一级标题通常是文档标题或章节的开篇。调整字号与颜色，再试试下边框——GitHub 风格的标题就有一条浅浅的底线。

正文紧跟在标题后面，用来观察段前与段后间距的节奏。`,
  h2: `## 二级标题：章节的分界

二级标题是大多数文档最常用的层级。给它一条下边框、加一点边框间距，就能得到 GitHub 式的章节分隔。

这一段正文帮助你看清标题的段前与段后间距。`,
  h3: `### 三级标题：小节的开始

三级标题之后是一段正文。三级及以下没有下边框令牌，靠字号、颜色与间距区分层级。`,
  h4: `#### 四级标题：更深一层

四级标题比正文只大一点点，适合细分小节。调整颜色可以让它从正文里跳出来。`,
  h5: `##### 五级标题：接近正文的尺寸

五级标题与正文几乎同大，常用字重或颜色来区分。`,
  h6: `###### 六级标题：最小的标题

六级标题比正文还小，多用作附注或标签式的小节名。`,
  strong: `在一句话里，被加粗的词总是最先被看到。把**字重**调到 700、给**文字颜色**换一个主题色，或者给**背景色**铺一层淡彩做成高亮笔——普通文字与**加粗文字**放在一起，对比最直观。`,
  em: `斜体适合标注书名、术语，或一句*轻轻强调的话*。普通文字与 *斜体文字* 摆在一起，倾斜与颜色一目了然；如果你偏好直立体，把「倾斜」切成「不倾斜」即可。`,
  del: `修订痕迹是删除线的本职：~~这里原来写错了一个词~~，改过来就好了。可以调整整体颜色，也可以只改删除线的颜色，让「划掉」成为版面上的一种语气。`,
  a: `链接常嵌在完整的句子里：这份主题的灵感来自 [GitHub Docs](https://docs.github.com)，排版依据是 [中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines)，也可以直接粘贴网址如 https://example.com 让它自动成链。把鼠标悬停到链接上，就能验证「下划线」的三种策略——始终显示、悬停显示或不显示。`,
  inlineCode: `行内代码常出现在句子里，比如运行 \`npm run dev\` 启动开发服务，或把 \`root.size\` 调成 \`18px\`。调整底色、圆角、边框与内边距，让代码片段在正文中既醒目又不突兀。`,
  ul: `无序列表适合罗列并列的要点，缩进与项间距都可以在右侧调整：

- 第一层：实心圆点，颜色可在右侧调整
- 嵌套一层会换成空心圆
  - 第二层：再往下是实心方块
    - 第三层：层级越深，缩进越明显
- 回到第一层：项间距控制相邻两行的疏密`,
  ol: `有序列表自带步骤感，编号颜色与缩进都可以调整：

1. 准备一份主题令牌表
2. 从正文开始逐项调校
   1. 先定字体与字号
   2. 再调行高与颜色
      1. 嵌套编号会换成小写字母
3. 导出 CSS，应用到你的文档`,
  task: `勾选框是自绘的:形状、边框、圆角、大小与勾选底色都可在右侧调整,已勾项文字还能单独配色:

- [x] 选定正文字体
- [x] 调整标题层级
- [ ] 打磨代码块配色
- [ ] 导出并分享主题`,
  quote: `> 引用块适合摘录与旁注。调整左边框的粗细与颜色，或铺一层浅浅的背景色，让引文与正文自然区分。

普通段落夹在中间，方便对照引用与正文的差异。

> 这是一段多段引用。
>
> 第二段仍在引用块里，用来观察背景色与内边距如何包裹整块内容；把「斜体」切成斜体，又是另一种语气。`,
  callout: `提示块是带语义的引用：首行写 [!NOTE] 等标记，整块就会换上强调色与图标。五类颜色都在右侧单独可调：

> [!NOTE]
> Note 蓝：补充说明、背景知识这类「知道了更好」的信息。

> [!TIP]
> Tip 绿：小技巧与最佳实践。

> [!IMPORTANT]
> Important 紫：用户必须了解的关键信息。

> [!WARNING]
> Warning 黄：可能导致出错的风险提醒。

> [!CAUTION]
> Caution 红：操作不当会有严重后果的警告。`,
  codeBlock: `下面是一段 TypeScript，背景色、圆角、边框与内边距都可以在右侧调整：

\`\`\`ts
interface ThemeTokens {
  'root.size'?: string
  'strong.color'?: string
}

function applyTheme(tokens: ThemeTokens): void {
  for (const [key, value] of Object.entries(tokens)) {
    const cssVar = '--t-' + key.replace('.', '-')
    document.documentElement.style.setProperty(cssVar, value)
  }
}

applyTheme({ 'root.size': '17px', 'strong.color': '#b91c1c' })
\`\`\``,
  table: `表格常用于语法速查与数据对比。斑马纹、行悬停与单元格边框都能在右侧逐项打开（把鼠标悬停到某一行，可以验证行悬停背景）：

| 令牌 | 作用 | 示例值 |
| ---- | ---- | ------ |
| table.stripeBg | 偶数行斑马纹 | oklch(0.97 0 0) |
| row.hoverBg | 行悬停背景 | oklch(0.95 0 0) |
| cell.rowLine + colLine | 行横线与竖线开关 | solid + none |
| th.bg | 表头背景 | oklch(0.96 0 0) |
| table.radius | 表格圆角 | 8px |
| table.collapse | 边框合并 | separate |`,
  hr: `分割线用来划分不相关的段落组——上方的这句话，与下方的内容并没有从属关系。

---

分割线下方的段落。分割线的颜色与粗细可在右侧调整；想要更轻的分隔感，把颜色调浅、粗细保持 1px 即可。`,
  img: `![主题工场的示例图片](${SAMPLE_IMAGE})

图片的最大宽度、圆角、边框与阴影都是可定制的；配一张说明文字，更能看出图与文的间距关系。点击预览里的图片可以打开灯箱放大查看。`,
}
