import type { TokenKey } from './tokens'
import { THEME_BASE_DEFAULTS } from './defaults'

/**
 * 元数据驱动的工场 UI：每个可定制元素注册一份字段描述，
 * 左栏元素导航、右栏属性面板全部由这份注册表自动生成。
 * 新增可定制元素（如 KaTeX、脚注）= 在这里加一条 + theme-base.css 消费 + tokens.ts 加键
 * + defaults.ts 登记回落值(占位符自动取,守门测试锁定与 CSS 一致)。
 */

/**
 * 未设置时的占位提示 = 令牌在基础样式表里的真实回落值(THEME_BASE_DEFAULTS)。
 * 字段定义不手写 placeholder,渲染端统一按 key 查表;查不到(颜色/字体等
 * 运行时实测类)由控件自己决定(实测回落色/「未设置」)。
 */
export function placeholderOf(key: TokenKey): string | undefined {
  return THEME_BASE_DEFAULTS[key]
}

export type FieldType =
  | 'color'        // 取色器 + hex 输入
  | 'size'         // 字号/间距：数字 + 单位（px/em/rem/%）
  | 'number'       // 纯数字（如行高倍数）
  | 'percent'      // 百分比：纯数字输入,固定 % 单位(比例类字段,长度单位无意义)
  | 'font-weight'  // 字重下拉 100–900
  | 'font-family'  // 字体：预设列表 + 自定义输入
  | 'select'       // 枚举下拉
  | 'text-align'   // 对齐分段控件
  | 'background'   // 画布背景：完整 CSS background 值（颜色/渐变/图片）
  | 'box'          // 四边盒值（上/右/下/左 独立数值 + 共享单位），存 CSS 简写字符串
  | 'marker-text'  // 列表自定义符号：输入裸符号,控件包装成 CSS content 字符串(加引号+尾随空格)
  | 'marker-template' // 有序列表编号模板：{n} 代表自动编号,控件编译成 counter() content 值
  | 'shadow'       // 盒阴影：X/Y/模糊/扩散 四格 + 颜色,存完整 box-shadow 值

export interface FieldDef {
  /** 令牌键（TOKEN_VAR 的键名） */
  key: TokenKey
  label: string
  type: FieldType
  /** 字段说明（控件下方的小字提示） */
  hint?: string
  /** select 的选项 */
  options?: { value: string; label: string }[]
  /** size/box 的默认单位 */
  unit?: string
  /** number 的步进/范围 */
  min?: number
  max?: number
  step?: number
  /** select 未设置时的默认值名(基础样式表回落),未设置时灰斜体回显该值 */
  defaultLabel?: string
  /** 面板分区标题:相邻字段同名分区归一块,工场在分区变化处插小标题(纯展示) */
  section?: string
}

export interface ElementDef {
  id: string
  label: string
  /** 导航分组 */
  group: 'basic' | 'headings' | 'inline' | 'lists' | 'blocks'
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

/** 有序列表编号样式(CSS counter style 关键字) */
const OL_MARKER_STYLE_OPTIONS = [
  { value: 'decimal', label: '阿拉伯数字（1 2 3）' },
  { value: 'decimal-leading-zero', label: '前导零（01 02 03）' },
  { value: 'lower-alpha', label: '小写字母（a b c）' },
  { value: 'upper-alpha', label: '大写字母（A B C）' },
  { value: 'lower-roman', label: '小写罗马（i ii iii）' },
  { value: 'upper-roman', label: '大写罗马（I II III）' },
  { value: 'cjk-ideographic', label: '中文序数（一 二 三）' },
  { value: 'none', label: '无编号（none）' },
]

/** 无序列表圆点形状(list-style-type 关键字) */
const UL_MARKER_SHAPE_OPTIONS = [
  { value: 'disc', label: '实心圆（disc）' },
  { value: 'circle', label: '空心圆（circle）' },
  { value: 'square', label: '方块（square）' },
  { value: 'none', label: '无标记（none）' },
]

export const ELEMENTS: ElementDef[] = [
  {
    id: 'root',
    label: '正文',
    group: 'basic',
    fields: [
      { key: 'root.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'root.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'root.size', label: '字号', type: 'size', unit: 'px' },
      { key: 'root.leading', label: '行高', type: 'number', min: 1, max: 3, step: 0.05 },
      { key: 'root.color', label: '文字颜色', type: 'color' },
      { key: 'app.bg', label: '画布背景', type: 'background', hint: '正文纸张之外的预览区整体;支持颜色、渐变与图片' },
      { key: 'root.bg', label: '纸张颜色', type: 'color', hint: '正文这页「纸」的底色;留空 = 透明,透出画布背景' },
      { key: 'root.width', label: '页面宽度', type: 'size', unit: 'rem' },
      { key: 'root.spacing', label: '字间距', type: 'size', unit: 'px' },
    ],
  },
  {
    id: 'p',
    label: '段落',
    group: 'basic',
    fields: [
      { key: 'p.marginBottom', label: '段间距', type: 'size', unit: 'em' },
      { key: 'p.align', label: '对齐', type: 'text-align' },
      { key: 'p.indent', label: '首行缩进', type: 'size', unit: 'em' },
    ],
  },
  {
    id: 'heading',
    label: '标题（共用）',
    group: 'headings',
    fields: [
      { key: 'heading.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'heading.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'heading.color', label: '颜色', type: 'color' },
      { key: 'heading.weight', label: '字重', type: 'font-weight' },
      { key: 'heading.leading', label: '行高', type: 'number', min: 1, max: 2.5, step: 0.05 },
      { key: 'heading.marginTop', label: '段前间距', type: 'size', unit: 'em' },
      { key: 'heading.marginBottom', label: '段后间距', type: 'size', unit: 'em' },
    ],
  },
  ...([
    ['h1', 'H1 一级'],
    ['h2', 'H2 二级'],
    ['h3', 'H3 三级'],
    ['h4', 'H4 四级'],
    ['h5', 'H5 五级'],
    ['h6', 'H6 六级'],
  ] as const).map(([id, label]) => ({
    id,
    label,
    group: 'headings' as const,
    fields: [
      { key: `${id}.fontLatin` as TokenKey, label: '西文字体', type: 'font-family' as const },
      { key: `${id}.fontCjk` as TokenKey, label: '中文字体', type: 'font-family' as const },
      { key: `${id}.size` as TokenKey, label: '字号', type: 'size' as const, unit: 'em' },
      { key: `${id}.color` as TokenKey, label: '颜色', type: 'color' as const },
      ...(id === 'h1' || id === 'h2'
        ? [
            { key: `${id}.borderWidth` as TokenKey, label: '下边框粗细', type: 'size' as const, unit: 'px' },
            { key: `${id}.borderColor` as TokenKey, label: '下边框颜色', type: 'color' as const },
            { key: `${id}.paddingBottom` as TokenKey, label: '边框间距', type: 'size' as const, unit: 'em' },
          ]
        : []),
    ],
  })),
  {
    id: 'strong',
    label: '加粗',
    group: 'inline',
    fields: [
      { key: 'strong.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'strong.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'strong.weight', label: '字重', type: 'font-weight' },
      { key: 'strong.color', label: '文字颜色', type: 'color' },
      { key: 'strong.bg', label: '背景色', type: 'color' },
      { key: 'strong.padding', label: '内边距', type: 'box', unit: 'em' },
      { key: 'strong.margin', label: '外边距', type: 'box', unit: 'em', hint: '行内元素,水平外边距才会撑开前后文字' },
    ],
  },
  {
    id: 'em',
    label: '斜体',
    group: 'inline',
    fields: [
      { key: 'em.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'em.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'em.weight', label: '字重', type: 'font-weight' },
      { key: 'em.style', label: '倾斜', type: 'select', defaultLabel: '倾斜', options: [
        { value: 'italic', label: '倾斜' },
        { value: 'normal', label: '不倾斜' },
      ] },
      { key: 'em.color', label: '文字颜色', type: 'color' },
      { key: 'em.bg', label: '背景色', type: 'color' },
      { key: 'em.padding', label: '内边距', type: 'box', unit: 'em' },
      { key: 'em.margin', label: '外边距', type: 'box', unit: 'em', hint: '行内元素,水平外边距才会撑开前后文字' },
    ],
  },
  {
    id: 'del',
    label: '删除线',
    group: 'inline',
    fields: [
      { key: 'del.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'del.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'del.weight', label: '字重', type: 'font-weight' },
      { key: 'del.color', label: '整体颜色', type: 'color' },
      { key: 'del.textColor', label: '删除线颜色', type: 'color' },
      { key: 'del.bg', label: '背景色', type: 'color' },
      { key: 'del.padding', label: '内边距', type: 'box', unit: 'em' },
      { key: 'del.thickness', label: '删除线粗细', type: 'size', unit: 'px', hint: '留空跟随浏览器默认;设置后删除线居中绘制' },
      { key: 'del.offset', label: '垂直偏移', type: 'size', unit: 'px', hint: '相对居中位置:正值下移、负值上移' },
      { key: 'del.margin', label: '外边距', type: 'box', unit: 'em', hint: '行内元素,水平外边距才会撑开前后文字' },
    ],
  },
  {
    id: 'a',
    label: '链接',
    group: 'inline',
    fields: [
      { key: 'a.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'a.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'a.weight', label: '字重', type: 'font-weight' },
      { key: 'a.color', label: '文字颜色', type: 'color' },
      { key: 'a.hoverColor', label: '悬停颜色', type: 'color' },
      { key: 'a.underline', label: '下划线', type: 'select', options: UNDERLINE_OPTIONS },
      { key: 'a.underlineColor', label: '下划线颜色', type: 'color' },
      { key: 'a.underlineHeight', label: '下划线粗细', type: 'size', unit: 'px' },
      { key: 'a.hoverLineColor', label: '悬停下划线色', type: 'color' },
      { key: 'a.transition', label: '悬停过渡时长', type: 'size', unit: 's', hint: 'hover 变色的动画时长,0=瞬时切换' },
      { key: 'a.bg', label: '背景色', type: 'color' },
      { key: 'a.padding', label: '内边距', type: 'box', unit: 'em' },
      { key: 'a.margin', label: '外边距', type: 'box', unit: 'em', hint: '行内元素,水平外边距才会撑开前后文字' },
    ],
  },
  {
    id: 'inlineCode',
    label: '行内代码',
    group: 'inline',
    fields: [
      { key: 'inlineCode.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'inlineCode.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'inlineCode.size', label: '字号', type: 'size', unit: 'em' },
      { key: 'inlineCode.weight', label: '字重', type: 'font-weight' },
      { key: 'inlineCode.color', label: '文字颜色', type: 'color' },
      { key: 'inlineCode.bg', label: '背景色', type: 'color' },
      { key: 'inlineCode.padding', label: '内边距', type: 'box', unit: 'em' },
      { key: 'inlineCode.margin', label: '外边距', type: 'box', unit: 'em', hint: '行内元素,水平外边距才会撑开前后文字' },
      { key: 'inlineCode.radius', label: '圆角', type: 'size', unit: 'px' },
      { key: 'inlineCode.borderWidth', label: '边框粗细', type: 'size', unit: 'px' },
      { key: 'inlineCode.borderColor', label: '边框颜色', type: 'color' },
    ],
  },
  {
    id: 'ul',
    label: '无序列表',
    group: 'lists',
    fields: [
      { key: 'list.indent', label: '缩进', type: 'size', unit: 'em', section: '共用' },
      { key: 'li.spacing', label: '项间距', type: 'size', unit: 'em', section: '共用' },
      { key: 'list.marginBottom', label: '列表下间距', type: 'size', unit: 'em', section: '共用' },
      { key: 'list.position', label: '标记位置', type: 'select', defaultLabel: '外侧（悬挂）', section: '共用', options: [
        { value: 'outside', label: '外侧（悬挂）' },
        { value: 'inside', label: '内侧（随缩进）' },
      ] },
      { key: 'ul.markerSize', label: '圆点大小', type: 'size', unit: 'em', section: '共用', hint: '全层级统一，相对列表文字的倍数' },
      { key: 'li.fontSize', label: '文字字号', type: 'size', unit: 'em', section: '共用', hint: '未设时跟随正文字号' },
      { key: 'li.leading', label: '文字行高', type: 'number', min: 1, max: 3, step: 0.05, section: '共用', hint: '未设时跟随正文行高' },
      { key: 'li.color', label: '文字颜色', type: 'color', section: '共用' },
      { key: 'ul.markerShape', label: '圆点形状', type: 'select', defaultLabel: '实心圆', section: '一级', options: UL_MARKER_SHAPE_OPTIONS },
      { key: 'ul.markerColor', label: '圆点颜色', type: 'color', section: '一级', hint: '未设二级/三级颜色时全层级生效' },
      { key: 'ul.markerText', label: '自定义符号', type: 'marker-text', section: '一级', hint: '输入符号替换圆点，如 ▸ ★ ✓' },
      { key: 'ul.markerShape2', label: '圆点形状', type: 'select', defaultLabel: '空心圆', section: '二级', options: UL_MARKER_SHAPE_OPTIONS },
      { key: 'ul.markerColor2', label: '圆点颜色', type: 'color', section: '二级' },
      { key: 'ul.markerText2', label: '自定义符号', type: 'marker-text', section: '二级' },
      { key: 'ul.markerShape3', label: '圆点形状', type: 'select', defaultLabel: '方块', section: '三级', options: UL_MARKER_SHAPE_OPTIONS },
      { key: 'ul.markerColor3', label: '圆点颜色', type: 'color', section: '三级' },
      { key: 'ul.markerText3', label: '自定义符号', type: 'marker-text', section: '三级' },
    ],
  },
  {
    id: 'ol',
    label: '有序列表',
    group: 'lists',
    fields: [
      { key: 'list.indent', label: '缩进', type: 'size', unit: 'em', section: '共用' },
      { key: 'li.spacing', label: '项间距', type: 'size', unit: 'em', section: '共用' },
      { key: 'list.marginBottom', label: '列表下间距', type: 'size', unit: 'em', section: '共用' },
      { key: 'list.position', label: '标记位置', type: 'select', defaultLabel: '外侧（悬挂）', section: '共用', options: [
        { value: 'outside', label: '外侧（悬挂）' },
        { value: 'inside', label: '内侧（随缩进）' },
      ] },
      { key: 'ol.markerSize', label: '编号大小', type: 'size', unit: 'em', section: '共用', hint: '全层级统一，相对列表文字的倍数' },
      { key: 'ol.markerColor', label: '编号颜色', type: 'color', section: '共用', hint: '全层级生效' },
      { key: 'li.fontSize', label: '文字字号', type: 'size', unit: 'em', section: '共用', hint: '未设时跟随正文字号' },
      { key: 'li.leading', label: '文字行高', type: 'number', min: 1, max: 3, step: 0.05, section: '共用', hint: '未设时跟随正文行高' },
      { key: 'li.color', label: '文字颜色', type: 'color', section: '共用' },
      { key: 'ol.markerStyle', label: '编号样式', type: 'select', defaultLabel: '阿拉伯数字', section: '一级', options: OL_MARKER_STYLE_OPTIONS },
      { key: 'ol.markerText', label: '自定义编号', type: 'marker-template', section: '一级', hint: '{n} = 自动编号；去掉 {n} 则整段变成固定符号' },
      { key: 'ol.markerStyle2', label: '编号样式', type: 'select', defaultLabel: '小写字母', section: '二级', options: OL_MARKER_STYLE_OPTIONS },
      { key: 'ol.markerText2', label: '自定义编号', type: 'marker-template', section: '二级' },
      { key: 'ol.markerStyle3', label: '编号样式', type: 'select', defaultLabel: '小写罗马', section: '三级', options: OL_MARKER_STYLE_OPTIONS },
      { key: 'ol.markerText3', label: '自定义编号', type: 'marker-template', section: '三级' },
    ],
  },
  {
    id: 'task',
    label: '任务列表',
    group: 'lists',
    fields: [
      { key: 'task.accent', label: '勾选框颜色', type: 'color', hint: '已勾时勾选框的底色,对勾恒为白色' },
      { key: 'task.size', label: '勾选框大小', type: 'size', unit: 'em' },
      { key: 'task.radius', label: '勾选框圆角', type: 'size', unit: 'px' },
      { key: 'task.borderWidth', label: '边框粗细', type: 'size', unit: 'px' },
      { key: 'task.borderColor', label: '边框颜色', type: 'color' },
      { key: 'task.doneColor', label: '完成文字颜色', type: 'color', hint: '已勾选项的文字颜色;未设置时与正文一致' },
      { key: 'task.todoColor', label: '未完成文字颜色', type: 'color', hint: '未勾选项的文字颜色;未设置时与正文一致' },
    ],
  },
  {
    id: 'quote',
    label: '引用',
    group: 'blocks',
    fields: [
      { key: 'quote.borderWidth', label: '左边框粗细', type: 'size', unit: 'px' },
      { key: 'quote.borderColor', label: '左边框颜色', type: 'color' },
      { key: 'quote.bg', label: '背景色', type: 'color' },
      { key: 'quote.color', label: '文字颜色', type: 'color' },
      { key: 'quote.style', label: '斜体', type: 'select', options: [
        { value: 'normal', label: '正常' },
        { value: 'italic', label: '斜体' },
      ] },
      { key: 'quote.radius', label: '圆角', type: 'size', unit: 'px' },
      { key: 'quote.padding', label: '内边距', type: 'box', unit: 'em' },
    ],
  },
  {
    id: 'callout',
    label: '提示块',
    group: 'blocks',
    fields: [
      { key: 'callout.borderWidth', label: '左边框粗细', type: 'size', unit: 'px', section: '共用' },
      { key: 'callout.radius', label: '圆角', type: 'size', unit: 'px', section: '共用' },
      { key: 'callout.padding', label: '内边距', type: 'box', unit: 'em', section: '共用' },
      { key: 'callout.bgOpacity', label: '背景深浅', type: 'percent', section: '共用', hint: '强调色混合进背景的比例，0 = 无背景' },
      { key: 'callout.note', label: 'Note', type: 'color', section: '颜色', hint: '> [!NOTE] 的强调色：边框/标题/背景同源' },
      { key: 'callout.tip', label: 'Tip', type: 'color', section: '颜色' },
      { key: 'callout.important', label: 'Important', type: 'color', section: '颜色' },
      { key: 'callout.warning', label: 'Warning', type: 'color', section: '颜色' },
      { key: 'callout.caution', label: 'Caution', type: 'color', section: '颜色' },
    ],
  },
  {
    id: 'codeBlock',
    label: '代码块',
    group: 'blocks',
    fields: [
      { key: 'codeBlock.fontLatin', label: '西文字体', type: 'font-family' },
      { key: 'codeBlock.fontCjk', label: '中文字体', type: 'font-family' },
      { key: 'codeBlock.size', label: '字号', type: 'size', unit: 'em' },
      { key: 'codeBlock.leading', label: '行高', type: 'number', min: 1, max: 2.5, step: 0.05 },
      { key: 'codeBlock.bg', label: '背景色', type: 'color' },
      { key: 'codeBlock.padding', label: '内边距', type: 'box', unit: 'em' },
      { key: 'codeBlock.radius', label: '圆角', type: 'size', unit: 'px' },
      { key: 'codeBlock.borderWidth', label: '边框粗细', type: 'size', unit: 'px' },
      { key: 'codeBlock.borderColor', label: '边框颜色', type: 'color' },
    ],
  },
  {
    id: 'table',
    label: '表格',
    group: 'blocks',
    fields: [
      { key: 'table.borderColor', label: '边框颜色', type: 'color' },
      { key: 'cell.rowLine', label: '行横线', type: 'select', defaultLabel: '显示', options: [
        { value: 'solid', label: '显示' },
        { value: 'none', label: '隐藏' },
      ] },
      { key: 'cell.colLine', label: '竖线', type: 'select', defaultLabel: '隐藏', options: [
        { value: 'none', label: '隐藏' },
        { value: 'solid', label: '显示' },
      ] },
      { key: 'cell.borderWidth', label: '线宽', type: 'size', unit: 'px', hint: '行横线、竖线与外框共用；颜色跟随「边框颜色」' },
      { key: 'th.bg', label: '表头背景', type: 'color' },
      { key: 'th.weight', label: '表头字重', type: 'font-weight' },
      { key: 'cell.padding', label: '单元格内边距', type: 'box', unit: 'em' },
      { key: 'table.stripeBg', label: '斑马纹背景', type: 'color', hint: '偶数行底色，不设置即无斑马纹' },
      { key: 'row.hoverBg', label: '行悬停背景', type: 'color' },
      { key: 'table.radius', label: '表格圆角', type: 'size', unit: 'px', hint: '需配合边框合并=separate 才生效' },
      { key: 'table.collapse', label: '边框合并', type: 'select', options: [{ value: 'collapse', label: '合并（collapse）' }, { value: 'separate', label: '分离（separate）' }], hint: 'separate 才能显示圆角与单元格间隙' },
    ],
  },
  {
    id: 'hr',
    label: '分割线',
    group: 'blocks',
    fields: [
      { key: 'hr.color', label: '颜色', type: 'color' },
      { key: 'hr.thickness', label: '粗细', type: 'size', unit: 'px' },
      { key: 'hr.margin', label: '外边距', type: 'box', unit: 'em' },
      { key: 'hr.padding', label: '内边距', type: 'box', unit: 'em', hint: '加大内边距 = 更宽的软色带' },
    ],
  },
  {
    id: 'img',
    label: '图片',
    group: 'blocks',
    fields: [
      { key: 'img.maxWidth', label: '最大宽度', type: 'size', unit: '%' },
      { key: 'img.width', label: '宽度', type: 'size', unit: 'px' },
      { key: 'img.height', label: '高度', type: 'size', unit: 'px' },
      { key: 'img.align', label: '水平对齐', type: 'select', defaultLabel: '左', options: [
        { value: '0', label: '左' },
        { value: 'auto', label: '居中' },
        { value: '0 auto', label: '右' },
      ] },
      { key: 'img.margin', label: '外边距', type: 'size', unit: 'em', hint: '图片上下的留白;左右间距由水平对齐决定' },
      { key: 'img.radius', label: '圆角', type: 'size', unit: 'px' },
      { key: 'img.borderWidth', label: '边框粗细', type: 'size', unit: 'px' },
      { key: 'img.borderColor', label: '边框颜色', type: 'color' },
      { key: 'img.shadow', label: '阴影', type: 'shadow' },
    ],
  },
]

/** 供恢复默认等操作：某元素涉及的全部令牌键 */
export function elementTokenKeys(elementId: string): TokenKey[] {
  const el = ELEMENTS.find((e) => e.id === elementId)
  return el ? el.fields.map((f) => f.key) : []
}
