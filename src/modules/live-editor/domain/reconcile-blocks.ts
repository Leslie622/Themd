/**
 * 块归属 diff(domain 层,纯函数):PM 顶层节点 ↔ sourceMap 块的重对账。
 *
 * PM 事务后文档树的未动子树按引用共享(ProseMirror 节点不可变),据此把
 * 新顶层节点按 === 归还到旧块;归不上的(新节点/原地替换/拆分产物)按位置
 * 保守归属,并把对应块标 dirty——dirty 块保存时走序列化,未动块逐字节吐
 * 原文(字节保真协议的运行时半边)。
 *
 * 保守策略(P3 收紧):跨块结构变化(拆分段落/删除节点)可能把相邻块一并
 * 标脏——过标安全(最多多序列化一块),漏标才破坏保真,绝不允许。
 */

/** 协议序列化需要的最小块面(markdown-engine 的 serializeLiveBlocks 消费) */
export interface SerializableBlock {
  /** 块原文(含块内换行与块尾终止符);dirty 时可用 dirtyText 覆盖 */
  text: string
  /** 块后空行(空行的换行属于 separator,块自身末行的终止符属于 text) */
  separator: string
  dirty: boolean
  /** dirty 块经 PM 序列化的新文本(含终止符);缺省按 text 兜底 */
  dirtyText?: string
}

/** 运行时块:parse 自 splitBlocks,随编辑事务增量重对账 */
export interface BlockRuntime extends SerializableBlock {
  /** 本块占据的顶层 PM 节点数(parse 期由控制器回填) */
  nodeCount: number
  /** 文档前导空行伪块(text='',无节点,永不参与归属) */
  pseudo: boolean
  /** reconcile 新建的块(用户在文档里造出的新块) */
  synthetic?: boolean
}

/** 归属重对账结果 */
export interface ReconcileResult {
  blocks: BlockRuntime[]
  /** 与 newNodes 平行:每个新顶层节点 → blocks 下标 */
  owners: number[]
}

/** 重对账的可选输入(P3 收紧:拆分归并与合成块行尾) */
export interface ReconcileOptions {
  /** 合成块(用户新造的块)的行尾风格,默认 '\n' */
  eol?: string
  /** 空段落判定(Enter 在块首拆出的空 P 归下一块,其余新节点归前一节点
   * 的块——把「段中拆分」关进同一个块,不再外溢标脏相邻块) */
  isEmptyParagraph?: (node: unknown) => boolean
}

/** 块尾终止符(与原文保持同型:\r\n / \n / 无) */
function terminatorOf(text: string): string {
  if (text.endsWith('\r\n')) return '\r\n'
  if (text.endsWith('\n')) return '\n'
  return ''
}

/**
 * 重对账。
 * @param blocks       旧块表(parse 或上一次 reconcile 的产物)
 * @param owners       与 oldNodes 平行:旧顶层节点 → blocks 下标
 * @param oldNodes     旧文档顶层节点数组(引用比较)
 * @param newNodes     新文档顶层节点数组(引用比较)
 * @param serialize    新节点组 → markdown 文本(不含终止符;由控制器注入引擎)
 */
export function reconcileBlocks(
  blocks: BlockRuntime[],
  owners: number[],
  oldNodes: readonly unknown[],
  newNodes: readonly unknown[],
  serialize: (nodes: unknown[]) => string,
  opts: ReconcileOptions = {},
): ReconcileResult {
  const eol = opts.eol ?? '\n'
  const isEmptyParagraph = opts.isEmptyParagraph ?? (() => false)
  // ── 第一遍:逐节点归属(带 matched 标记) ─────────────────────────
  const rawOwners: number[] = []
  const matched: boolean[] = []
  let oi = 0
  for (let ni = 0; ni < newNodes.length; ni++) {
    const cur = newNodes[ni]
    if (oi < oldNodes.length && cur === oldNodes[oi]) {
      rawOwners[ni] = owners[oi]
      matched[ni] = true
      oi++
      continue
    }
    // 插入:new[ni] 是 old[oi] 之前多出来的节点。归属细分(P3):
    // - 空段落 → Enter 打在块首,归下一块(它才是被拆的对象)
    // - 非空(段中拆分的后半等) → 归前一节点的块,把拆分关进同一个块
    if (
      oi < oldNodes.length &&
      ni + 1 < newNodes.length &&
      newNodes[ni + 1] === oldNodes[oi]
    ) {
      rawOwners[ni] = isEmptyParagraph(cur)
        ? owners[oi]
        : (ni > 0 ? rawOwners[ni - 1] : owners[oi])
      matched[ni] = false
      continue
    }
    // 删除:old[oi] 被删,cur 命中 old[oi+1]
    if (oi + 1 < oldNodes.length && cur === oldNodes[oi + 1]) {
      oi++
      rawOwners[ni] = owners[oi]
      matched[ni] = true
      oi++
      continue
    }
    // 原地替换/拆分/尾部新增
    if (oi < oldNodes.length) {
      rawOwners[ni] = owners[oi]
      matched[ni] = false
      oi++
    } else {
      rawOwners[ni] = ni > 0 ? rawOwners[ni - 1] : -1
      matched[ni] = false
    }
  }

  // ── 第二遍:连续同块节点合并为 run,按首现顺序重建块表 ─────────────
  interface Run {
    owner: number
    from: number
    count: number
    anyUnmatched: boolean
  }
  const runs: Run[] = []
  for (let ni = 0; ni < newNodes.length; ) {
    const owner = rawOwners[ni]
    const from = ni
    while (ni < newNodes.length && rawOwners[ni] === owner) ni++
    const count = ni - from
    const anyUnmatched = matched.slice(from, from + count).some((m) => !m)
    runs.push({ owner, from, count, anyUnmatched })
  }

  // 按 owner 首现顺序分组
  const grouped = new Map<number, Run[]>()
  for (const run of runs) {
    const bucket = grouped.get(run.owner)
    if (bucket) bucket.push(run)
    else grouped.set(run.owner, [run])
  }

  const outBlocks: BlockRuntime[] = []
  // 前导伪块永不参与归属,常驻队首
  for (const b of blocks) {
    if (b.pseudo) outBlocks.push(b)
  }
  // owner(-1 的合成块除外) → 输出下标映射,供 owners 重排
  const outIndexOf = new Map<number, number>()
  for (const [owner, rs] of grouped) {
    const total = rs.reduce((sum, r) => sum + r.count, 0)
    const nodes: unknown[] = []
    for (const r of rs) nodes.push(...newNodes.slice(r.from, r.from + r.count))
    const anyUnmatched = rs.some((r) => r.anyUnmatched)
    outIndexOf.set(owner, outBlocks.length)
    if (owner === -1) {
      // 无主新节点:用户造出的新块(空文档起笔等);行尾/空行跟随档案
      outBlocks.push({
        text: `${serialize(nodes)}${eol}`,
        separator: eol,
        dirty: true,
        nodeCount: total,
        pseudo: false,
        synthetic: true,
      })
      continue
    }
    const b = blocks[owner]
    const nodesChanged = anyUnmatched || rs.length > 1 || total !== b.nodeCount
    const dirty = b.dirty || nodesChanged
    // 节点又变了 → 重生成;纯脏标记延续(节点未动) → 沿用上次产物
    const dirtyText = nodesChanged
      ? `${serialize(nodes)}${terminatorOf(b.dirtyText ?? b.text)}`
      : b.dirtyText
    outBlocks.push({ ...b, dirty, nodeCount: total, ...(dirtyText !== undefined ? { dirtyText } : {}) })
  }
  // 从未出现的旧块(非伪)被删除:不进 outBlocks,其 text+separator 一并移除

  // 新合成块的落位分隔:前一块 separator 为空时补足空行(否则两块粘连成懒延续)
  for (let i = 0; i < outBlocks.length; i++) {
    if (!outBlocks[i].synthetic) continue
    const prev = outBlocks[i - 1]
    if (prev && prev.separator === '') {
      prev.separator = prev.text.endsWith('\n') ? eol : `${eol}${eol}`
    }
  }
  // 合成块在队尾时不应拖尾空行
  const last = outBlocks[outBlocks.length - 1]
  if (last?.synthetic) last.separator = ''

  // owners 重排:与 newNodes 平行,指向 outBlocks 下标
  const finalOwners: number[] = []
  for (const run of runs) {
    const idx = outIndexOf.get(run.owner) ?? -1
    for (let k = 0; k < run.count; k++) finalOwners.push(idx)
  }

  return { blocks: outBlocks, owners: finalOwners }
}
