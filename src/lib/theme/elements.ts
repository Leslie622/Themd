import type { TokenKey } from './tokens'

/**
 * 元数据驱动的工场 UI：每个可定制元素注册一份字段描述，
 * 左栏元素导航、右栏属性面板全部由这份注册表自动生成。
 * 新增可定制元素（如 KaTeX、脚注）= 在这里加一条 + theme-base.css 消费 + tokens.ts 加键。
 */

export type FieldType =
  | 'color'        // 取色器 + hex 输入
  | 'size'         // 字号/间距：数字 + 单位（px/em/rem/%）
  | 'number'       // 纯数字（如行高倍数）
  | 'font-weight'  // 字重下拉 100–900
  | 'font-family'  // 字体：预设列表 + 自定义输入
  | 'select'       // 枚举下拉
  | 'text-align'   // 对齐分段控件
  | 'text'         // 自由文本（如 box-shadow）

export interface FieldDef {
  /** 令牌键（TOKEN_VAR 的键名） */
  key: TokenKey
  label: string
  type: FieldType
  /** 字段说明（控件下方的小字提示） */
  hint?: string
  /** select 的选项 */
  options?: { value: string; label: string }[]
  /** size 的默认单位 */
  unit?: string
  /** number 的步进/范围 */
  min?: number
  max?: number
  step?: number
  /** 占位提示（未设置时显示） */
  placeholder?: string
}

export interface ElementDef {
  id: string
  label: string
  /** 导航分组 */
  group: 'basic' | 'headings' | 'inline' | 'lists' | 'blocks'
  /** 预览里定位样例文档的锚文本（debug 用，运行时不需要） */
  sampleHint?: string
  fields: FieldDef[]
}

export const ELEMENT_GROUPS: { id: ElementDef['group']; label: string }[] = [
  { id: 'basic', label: '基础' },
  { id: 'headings', label: '标题' },
  { id: 'inline', label: '行内元素' },
  { id: 'lists', label: '列表' },
  { id: 'blocks', label: '块级元素' },
]

const UNDERLINE_OPTIONS = [
  { value: 'always', label: '始终显示' },
  { value: 'hover', label: '悬停显示' },
  { value: 'none', label: '不显示' },
]

export const ELEMENTS: ElementDef[] = [
  {
    id: 'root',
    label: '正文',
    group: 'basic',
    sampleHint: '正文段落',
    fields: [
      { key: 'root.font', label: '字体', type: 'font-family' },
      { key: 'root.size', label: '字号', type: 'size', unit: 'px', placeholder: '16px' },
      { key: 'root.leading', label: '行高', type: 'number', min: 1, max: 3, step: 0.05, placeholder: '1.75' },
      { key: 'root.color', label: '文字颜色', type: 'color' },
      { key: 'root.bg', label: '页面背景', type: 'color', hint: '留空 = 透明,跟随应用背景' },
      { key: 'root.width', label: '页面宽度', type: 'size', unit: 'rem', placeholder: '48rem', hint: '正文最大宽度' },
      { key: 'root.spacing', label: '字间距', type: 'size', unit: 'px', placeholder: 'normal' },
    ],
  },
  {
    id: 'p',
    label: '段落',
    group: 'basic',
    fields: [
      { key: 'p.marginBottom', label: '段间距', type: 'size', unit: 'em', placeholder: '1.25em' },
      { key: 'p.align', label: '对齐', type: 'text-align' },
      { key: 'p.indent', label: '首行缩进', type: 'size', unit: 'em', placeholder: '0' },
    ],
  },
  {
    id: 'heading',
    label: '标题（共用）',
    group: 'headings',
    fields: [
      { key: 'heading.font', label: '字体', type: 'font-family' },
      { key: 'heading.color', label: '颜色', type: 'color' },
      { key: 'heading.weight', label: '字重', type: 'font-weight' },
      { key: 'heading.leading', label: '行高', type: 'number', min: 1, max: 2.5, step: 0.05, placeholder: '1.3' },
      { key: 'heading.marginTop', label: '段前间距', type: 'size', unit: 'em', placeholder: '1.6em' },
      { key: 'heading.marginBottom', label: '段后间距', type: 'size', unit: 'em', placeholder: '0.6em' },
    ],
  },
  ...([
    ['h1', 'H1 一级', '2em'],
    ['h2', 'H2 二级', '1.5em'],
    ['h3', 'H3 三级', '1.22em'],
    ['h4', 'H4 四级', '1.05em'],
    ['h5', 'H5 五级', '1em'],
    ['h6', 'H6 六级', '0.9em'],
  ] as const).map(([id, label, size]) => ({
    id,
    label,
    group: 'headings' as const,
    fields: [
      { key: `${id}.size` as TokenKey, label: '字号', type: 'size' as const, unit: 'em', placeholder: size },
      { key: `${id}.color` as TokenKey, label: '颜色', type: 'color' as const },
      ...(id === 'h1' || id === 'h2'
        ? [
            { key: `${id}.borderWidth` as TokenKey, label: '下边框粗细', type: 'size' as const, unit: 'px', placeholder: '0' },
            { key: `${id}.borderColor` as TokenKey, label: '下边框颜色', type: 'color' as const },
            { key: `${id}.paddingBottom` as TokenKey, label: '边框间距', type: 'size' as const, unit: 'em', placeholder: '0' },
          ]
        : []),
    ],
  })),
  {
    id: 'strong',
    label: '加粗',
    group: 'inline',
    sampleHint: '加粗',
    fields: [
      { key: 'strong.weight', label: '字重', type: 'font-weight' },
      { key: 'strong.color', label: '文字颜色', type: 'color' },
      { key: 'strong.bg', label: '背景色', type: 'color', hint: '可做「高亮笔」效果' },
      { key: 'strong.padding', label: '内边距', type: 'size', unit: 'em', placeholder: '0', hint: '配背景色使用' },
    ],
  },
  {
    id: 'em',
    label: '斜体',
    group: 'inline',
    sampleHint: '斜体',
    fields: [
      { key: 'em.style', label: '倾斜', type: 'select', options: [
        { value: 'italic', label: '倾斜' },
        { value: 'normal', label: '不倾斜' },
      ] },
      { key: 'em.color', label: '颜色', type: 'color' },
    ],
  },
  {
    id: 'del',
    label: '删除线',
    group: 'inline',
    sampleHint: '删除线',
    fields: [
      { key: 'del.color', label: '整体颜色', type: 'color' },
      { key: 'del.textColor', label: '删除线颜色', type: 'color' },
    ],
  },
  {
    id: 'a',
    label: '链接',
    group: 'inline',
    sampleHint: '链接',
    fields: [
      { key: 'a.color', label: '颜色', type: 'color' },
      { key: 'a.underline', label: '下划线', type: 'select', options: UNDERLINE_OPTIONS },
    ],
  },
  {
    id: 'inlineCode',
    label: '行内代码',
    group: 'inline',
    sampleHint: '行内代码',
    fields: [
      { key: 'inlineCode.font', label: '字体', type: 'font-family' },
      { key: 'inlineCode.size', label: '字号', type: 'size', unit: 'em', placeholder: '0.875em' },
      { key: 'inlineCode.color', label: '文字颜色', type: 'color' },
      { key: 'inlineCode.bg', label: '背景色', type: 'color' },
      { key: 'inlineCode.padding', label: '内边距', type: 'text', placeholder: '0.2em 0.35em' },
      { key: 'inlineCode.radius', label: '圆角', type: 'size', unit: 'px', placeholder: '4px' },
      { key: 'inlineCode.borderWidth', label: '边框粗细', type: 'size', unit: 'px', placeholder: '0' },
      { key: 'inlineCode.borderColor', label: '边框颜色', type: 'color' },
    ],
  },
  {
    id: 'list',
    label: '列表',
    group: 'lists',
    sampleHint: '列表',
    fields: [
      { key: 'list.indent', label: '缩进', type: 'size', unit: 'em', placeholder: '1.5em' },
      { key: 'li.spacing', label: '项间距', type: 'size', unit: 'em', placeholder: '0.375em' },
      { key: 'ul.markerColor', label: '无序圆点色', type: 'color' },
      { key: 'ol.markerColor', label: '有序编号色', type: 'color' },
    ],
  },
  {
    id: 'task',
    label: '任务列表',
    group: 'lists',
    sampleHint: '任务列表',
    fields: [
      { key: 'task.accent', label: '勾选框颜色', type: 'color' },
    ],
  },
  {
    id: 'quote',
    label: '引用',
    group: 'blocks',
    sampleHint: '引用',
    fields: [
      { key: 'quote.borderWidth', label: '左边框粗细', type: 'size', unit: 'px', placeholder: '3px' },
      { key: 'quote.borderColor', label: '左边框颜色', type: 'color' },
      { key: 'quote.bg', label: '背景色', type: 'color' },
      { key: 'quote.color', label: '文字颜色', type: 'color' },
      { key: 'quote.style', label: '斜体', type: 'select', options: [
        { value: 'normal', label: '正常' },
        { value: 'italic', label: '斜体' },
      ] },
      { key: 'quote.radius', label: '圆角', type: 'size', unit: 'px', placeholder: '0' },
      { key: 'quote.padding', label: '内边距', type: 'text', placeholder: '0.25em 1em' },
    ],
  },
  {
    id: 'codeBlock',
    label: '代码块',
    group: 'blocks',
    sampleHint: '代码块',
    fields: [
      { key: 'codeBlock.font', label: '字体', type: 'font-family' },
      { key: 'codeBlock.size', label: '字号', type: 'size', unit: 'em', placeholder: '0.875em' },
      { key: 'codeBlock.leading', label: '行高', type: 'number', min: 1, max: 2.5, step: 0.05, placeholder: '1.6' },
      { key: 'codeBlock.bg', label: '背景色', type: 'color' },
      { key: 'codeBlock.padding', label: '内边距', type: 'text', placeholder: '1em 1.25em' },
      { key: 'codeBlock.radius', label: '圆角', type: 'size', unit: 'px', placeholder: '8px' },
      { key: 'codeBlock.borderWidth', label: '边框粗细', type: 'size', unit: 'px', placeholder: '0' },
      { key: 'codeBlock.borderColor', label: '边框颜色', type: 'color' },
    ],
  },
  {
    id: 'table',
    label: '表格',
    group: 'blocks',
    sampleHint: '表格',
    fields: [
      { key: 'table.borderColor', label: '边框颜色', type: 'color' },
      { key: 'th.bg', label: '表头背景', type: 'color' },
      { key: 'th.weight', label: '表头字重', type: 'font-weight' },
      { key: 'cell.padding', label: '单元格内边距', type: 'text', placeholder: '0.5em 0.85em' },
      { key: 'table.stripeBg', label: '斑马纹背景', type: 'color', hint: '偶数行底色，不设置即无斑马纹' },
    ],
  },
  {
    id: 'hr',
    label: '分割线',
    group: 'blocks',
    sampleHint: '分割线',
    fields: [
      { key: 'hr.color', label: '颜色', type: 'color' },
      { key: 'hr.thickness', label: '粗细', type: 'size', unit: 'px', placeholder: '1px' },
    ],
  },
  {
    id: 'img',
    label: '图片',
    group: 'blocks',
    sampleHint: '图片',
    fields: [
      { key: 'img.maxWidth', label: '最大宽度', type: 'size', unit: '%', placeholder: '100%' },
      { key: 'img.radius', label: '圆角', type: 'size', unit: 'px', placeholder: '4px' },
      { key: 'img.borderWidth', label: '边框粗细', type: 'size', unit: 'px', placeholder: '0' },
      { key: 'img.borderColor', label: '边框颜色', type: 'color' },
      { key: 'img.shadow', label: '阴影', type: 'text', placeholder: 'none', hint: 'CSS box-shadow 值' },
    ],
  },
]

/** 供恢复默认等操作：某元素涉及的全部令牌键 */
export function elementTokenKeys(elementId: string): TokenKey[] {
  const el = ELEMENTS.find((e) => e.id === elementId)
  return el ? el.fields.map((f) => f.key) : []
}
