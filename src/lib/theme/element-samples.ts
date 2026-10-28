/**
 * 元素级迷你样例：右栏「元素效果」卡片只渲染当前选中元素对应的一小段 md,
 * 让用户改样式时有直接参照物,不依赖中栏的大示例文档。
 * key 与 elements.ts 的 ElementDef.id 对应。
 */
export const ELEMENT_SAMPLES: Record<string, string> = {
  root: '正文示例:Themd 是一本样式自设的 Markdown 笔记本。调整字体、字号、行高与颜色,这里立即变化。',
  p: '第一段:这是一个段落示例,用于观察段间距与对齐。\n\n第二段:调整首行缩进后,段落的疏密关系一目了然。',
  heading: '# 一级标题\n\n## 二级标题\n\n### 三级标题',
  h1: '# 一级标题示例',
  h2: '## 二级标题示例',
  h3: '### 三级标题示例',
  h4: '#### 四级标题示例',
  h5: '##### 五级标题示例',
  h6: '###### 六级标题示例',
  strong: '普通文字与**加粗文字**放在一起,颜色、字重、背景的对比最直观。',
  em: '普通文字与 *斜体文字* 的对比效果。',
  del: '普通文字与 ~~被删除的文字~~ 的对比效果。',
  a: '这是一个[示例链接](https://example.com),下划线策略悬停即可验证。',
  inlineCode: '普通文字中的行内代码 `const x = 1` 效果。',
  ul: '- 无序列表项一\n- 无序列表项二\n  - 嵌套子项样式为空心圆',
  ol: '1. 有序列表项一\n2. 有序列表项二\n   1. 嵌套子项为字母编号',
  task: '- [x] 已完成的任务\n- [ ] 待办的任务',
  quote: '> 这是一段引用文字,\n> 调整边框、底色与文字色立即可见。',
  codeBlock: '```ts\nconst theme = { name: "demo" }\nconsole.log(`Hello, ${theme.name}!`)\n```',
  table: '| 语法 | 元素 | 可定制 |\n| ---- | ---- | ---- |\n| **加粗** | strong | 颜色/字重 |\n| `代码` | code | 底色/圆角 |',
  hr: '分割线上方\n\n---\n\n分割线下方',
  img:
    '![示例图片](data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27260%27%20height=%2790%27%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20fill=%27%23e5e7eb%27/%3E%3Ctext%20x=%2750%25%27%20y=%2750%25%27%20text-anchor=%27middle%27%20dominant-baseline=%27middle%27%20fill=%27%236b7280%27%20font-size=%2714%27%3E%E7%A4%BA%E4%BE%8B%E5%9B%BE%E7%89%87%20Sample%3C/text%3E%3C/svg%3E)',
}
