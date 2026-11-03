/**
 * 标题锚点 id 生成(渲染统一第 5 步自 markdown-renderer 拆出的共享纯函数):
 * 静态序列化器(static-html)的 heading id 与大纲(outline)的 TOC 锚点
 * 共用同一函数,保证跳转 querySelector 直接命中。markdown-it oracle 的
 * heading_open 规则同样引用此实现,三面 id 同源。
 */
export const slug = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
