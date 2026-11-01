/**
 * 主题工场的「全内容样例」：一份覆盖全部常用 Markdown 元素的标准文档,
 * 用于从整体上检视主题的完整观感。写作约束:
 * - 只用渲染管线实际支持的语法:CommonMark + GFM(表格/任务列表/删除线)+ 自动链接;
 *   KaTeX 与 mermaid 不进样例(工场预览不加载对应 CSS,也无异步渲染)。
 * - 正文文案用全角中文标点(样例本身就是排版示范);代码块/行内代码/链接除外。
 * - 每种可定制元素至少出现一次;标题给满 H1–H6,列表给足嵌套层级,便于观察间距与缩进。
 * - 示例图片用 png data URL(markdown-it 默认只放行 gif/png/jpeg/webp 的 data 链接)。
 * - 模板字符串内 ` 与 ${ 必须转义。
 */
import { SAMPLE_IMAGE } from './element-samples'

export const SAMPLE_DOC = `# Themd 主题样例

> 一份覆盖全部常用 Markdown 元素的标准文档。调整右侧的令牌，这片预览会实时告诉你答案。

## 标题层级

### 三级标题

三级及以下的标题靠字号、颜色与间距区分层级。

#### 四级标题

##### 五级标题

###### 六级标题

## 段落与行内元素

这一段集中展示行内样式的对比：**加粗文字**、*斜体文字*、***粗斜体***、~~删除线~~、\`行内代码\`，以及一个[普通链接](https://example.com)。裸网址也能自动成链：https://github.com 。

第二段用来观察段落间距与行高。排版的基本单位是段落，段间距决定文档的呼吸感——把它调得舒展一些，长文读起来更轻松；中文排印的引号“样例”与省略号……由排版器统一处理。

## 引用

> 单层引用：好的排版让阅读成为享受。
>
> 引用可以有多段，背景色与内边距会包裹整块内容。

> 嵌套引用：
> > 引用中的引用，左边框的层级依然清晰。

## 列表

无序列表（嵌套时圆点逐级变化）：

- 水果
  - 苹果
  - 橘子
    - 蜜橘
- 蔬菜
- 谷物

有序列表：

1. 打开一个目录作为工作区
2. 新建一篇笔记
   1. 写下标题
   2. 敲下正文
3. 在主题工场里应用你的主题

任务列表：

- [x] 定义正文令牌
- [x] 校准标题层级
- [ ] 打磨表格与代码块
- [ ] 导出主题分享给朋友

## 代码

行内代码如 \`npm run dev\`。下面是 TypeScript 代码块：

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
\`\`\`

Bash 与 JSON 也常出现在笔记里：

\`\`\`bash
# 安装依赖并启动开发服务
npm install
npm run dev
\`\`\`

\`\`\`json
{
  "name": "my-theme",
  "tokens": { "root.size": "17px", "a.underline": "hover" }
}
\`\`\`

## 表格

| 语法 | 渲染元素 | 常用令牌 | 对齐 |
| :--- | :------- | :------- | ----: |
| \`**加粗**\` | strong | strong.color / strong.weight | 左 |
| \`*斜体*\` | em | em.style / em.color | 中 |
| \`~~删除~~\` | del | del.textColor | 右 |
| \`> 引用\` | blockquote | quote.borderColor / quote.bg | 左 |

## 分割线与图片

---

![主题工场的示例图片](${SAMPLE_IMAGE})
图片上方是一条分割线，下方是一张图片：圆角、边框与阴影都可以在「图片」里定制，点击图片可放大查看。

## 结语

**每一个元素，都能是你喜欢的样子。** 从正文开始，逐个打磨标题、引用、列表与代码块，直到整篇文档都符合你的审美。
`
