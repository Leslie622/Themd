/**
 * LiveEditorController(application 层):content 字符串 ↔ PM 文档的同步边界。
 *
 * 职责(方案 §5 数据流):
 * - parse:content → splitBlocks → 逐块 parse 拼装 doc JSON(块与顶层节点
 *   的归属在 parse 期建立)
 * - 编辑:onUpdate(doc) → reconcileBlocks 重对账 → serializeLiveBlocks
 *   产出新 content(未动块逐字节原文,dirty 块走引擎序列化)
 * - 外部重载:rebind 整体重建(等价 CM 的 remount 语义)
 *
 * headless 可测:PM 的 EditorState/事务不依赖 DOM,守门测试在 node 环境跑。
 */
import { getSchema } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

import { splitBlocks } from '../domain/block-source-map'
import { reconcileBlocks, type BlockRuntime } from '../domain/reconcile-blocks'
import {
  applyBulletStyle,
  applyEol,
  buildProfile,
  type SerializeProfile,
} from '../domain/serialize-profile'
import { liveExtensions } from '../infrastructure/tiptap-setup'
import { getMarkdownManager, parseBlockMarkdown, serializeLiveBlocks } from '../infrastructure/markdown-engine'
import { setActiveProfile } from '../infrastructure/serialize-profile-state'

/** 编辑器 schema:liveExtensions 唯一装配(与 markdown 引擎同源) */
export const liveSchema = getSchema([...liveExtensions()])

/** 单块解析出的顶层节点数组(空块/伪块 → []) */
function blockNodes(text: string): JSONContent[] {
  if (text.trim() === '') return []
  const doc = parseBlockMarkdown(text.replace(/\r?\n$/, ''))
  return doc.content ?? []
}

export class LiveEditorController {
  private blocks: BlockRuntime[] = []
  private owners: number[] = []
  private lastNodes: readonly PMNode[] = []
  private lastContent: string
  /** 本篇风格档案:dirty 块序列化输出跟随全文风格(列表/强调/行尾) */
  private profile: SerializeProfile = buildProfile('')

  constructor(content: string) {
    this.lastContent = content
    this.rebuild(content)
  }

  /** parse 产物:编辑器初始 content(doc JSON) */
  buildDocJson(): JSONContent {
    const content: JSONContent[] = []
    for (const b of this.blocks) {
      if (b.pseudo) continue
      content.push(...blockNodes(b.text))
    }
    return { type: 'doc', content }
  }

  /** 外部改动/换笔记:整体重建 */
  rebind(content: string): JSONContent {
    this.lastContent = content
    this.rebuild(content)
    return this.buildDocJson()
  }

  /**
   * 编辑器装载初始 content 后调用:用真实文档节点种子化归属表。
   * 不调的话首次 onUpdate 会把全部顶层节点误判为新增。
   */
  seed(doc: PMNode): void {
    this.lastNodes = doc.content.content
  }

  /**
   * 编辑事务后调用:重对账并产出新 content;无变化返回 null。
   * @param doc 编辑器当前文档(顶层子节点按引用比较)
   */
  onUpdate(doc: PMNode): string | null {
    const newNodes = doc.content.content
    const serialize = (nodes: unknown[]) => this.serializeNodes(nodes)
    const { blocks, owners } = reconcileBlocks(
      this.blocks,
      this.owners,
      this.lastNodes,
      newNodes,
      serialize,
      {
        eol: this.profile.eol,
        isEmptyParagraph: (n) => {
          const node = n as PMNode
          return node.type?.name === 'paragraph' && node.childCount === 0
        },
      },
    )
    this.blocks = blocks
    this.owners = owners
    this.lastNodes = newNodes
    const content = serializeLiveBlocks(this.blocks)
    if (content === this.lastContent) return null
    this.lastContent = content
    return content
  }

  /** 序列化节点组并应用风格档案(列表标记 + 行尾;强调在扩展层跟随) */
  private serializeNodes(nodes: unknown[]): string {
    const manager = getMarkdownManager()
    const raw = manager.serialize({
      type: 'doc',
      content: nodes.map((n) => (n as PMNode).toJSON()),
    })
    return applyEol(applyBulletStyle(raw, this.profile.bullet), this.profile.eol)
  }

  private rebuild(content: string): void {
    // 档案先于 parse 落位:Bold/Italic 覆盖在序列化期读取(Bold 渲染时),
    // manager 单例跨笔记共享,必须每篇重设
    this.profile = buildProfile(content)
    setActiveProfile(this.profile)
    const records = splitBlocks(content)
    this.blocks = records.map((r) => ({
      text: r.text,
      separator: r.separator,
      dirty: false,
      nodeCount: 0,
      pseudo: r.text === '',
    }))
    // parse 期建立归属:块 i 占据顶层节点 [offset, offset+count)
    const owners: number[] = []
    records.forEach((r, i) => {
      const nodes = blockNodes(r.text)
      this.blocks[i].nodeCount = nodes.length
      for (let k = 0; k < nodes.length; k++) owners.push(i)
    })
    this.owners = owners
    this.lastNodes = []
  }
}
