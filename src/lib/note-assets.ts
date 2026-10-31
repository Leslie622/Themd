import type { FileGateway } from '@/platform/contracts'
import { useEditorPrefs } from '@/store-editor'

/**
 * 文件绑定时的图片资产迁移:笔记绑定/另存为到某个目录后,正文里的
 * `assets/…` 相对路径按「新笔记目录/assets」解析,原图不在那里就会裂图。
 * 绑定的那一刻把引用到的图片**原样字节**复制过来(零重编码,保真与
 * 本地 assets 模式一致),图片随文件走。
 *
 * files 网关由组合根注入(services.ts),本模块不 import platform——
 * 否则 services → 本模块 → platform → services 成环,vitest 下炸初始化。
 */

/** 从 markdown 正文提取本地 assets 图片引用(去重) */
export function extractAssetRefs(content: string): string[] {
  const refs = new Set<string>()
  for (const match of content.matchAll(/!\[[^\]]*\]\((assets\/[^)\s]+?\.[\w]+)\)/g)) {
    refs.add(match[1])
  }
  return [...refs]
}

/** Windows 桌面端路径拼接(文件绑定仅桌面端可用) */
function joinPath(dir: string, ...segs: string[]): string {
  return `${dir.replace(/[\\/]+$/, '')}\\${segs.join('\\')}`
}

/**
 * 把正文引用的 assets 图片迁入 toDir/assets。
 * 来源优先旧笔记目录(绑定→另存为场景),回落全局图片根(库内→首绑场景,
 * 插图当时落在全局 assetsRoot);目标已有同名文件跳过(幂等,重复另存不重写);
 * 单张失败不中断其余(缺一张图不该阻塞整个绑定)。
 */
export async function migrateNoteAssets(files: FileGateway, content: string, fromDir: string | null, toDir: string): Promise<void> {
  const refs = extractAssetRefs(content)
  if (!refs.length) return
  const customRoot = useEditorPrefs.getState().assetsRoot.trim()
  const globalRoot = customRoot || await files.defaultAssetsRoot()
  const destDir = joinPath(toDir, 'assets')
  for (const ref of refs) {
    const name = ref.slice('assets/'.length)
    const dest = joinPath(destDir, name)
    const sources = [
      fromDir ? joinPath(fromDir, 'assets', name) : null,
      globalRoot ? joinPath(globalRoot, name) : null,
    ].filter((source): source is string => Boolean(source && source !== dest))
    for (const source of sources) {
      try {
        const bytes = await files.readBinaryFile(source)
        await files.writeBinaryFile(dest, bytes)
        break
      } catch {
        // 该来源不存在/读失败:尝试下一个来源
      }
    }
  }
}
