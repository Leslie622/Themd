/**
 * 图片文件 → markdown 引用(application 层):复用 lib/image.ts 三模式
 * 落盘管线(本地 assets/图床上传/内嵌),产出 `![alt](src)` 字符串。
 * 与 EditorPane 的 CM 版同策略(toast/失败中止),插入动作由调用方决定
 * (PM 版经 insertMarkdown 解析后插入,渲染态直接成图)。
 */
import { toast } from 'sonner'

import {
  fileToAssetImage,
  fileToEmbeddedImage,
  fileToUploadedImage,
} from '@/lib/image'
import { platformServices } from '@/app/platform'
import { useEditorPrefs } from '@/store-editor'

/**
 * 批量处理图片文件为 markdown 引用;全部为图片才接管事件,返回 null 表示
 * 未接管。失败逐张 toast 并跳过(与 CM 版一致)。
 */
export async function imageFilesToMarkdown(
  files: File[],
  noteDir: string | null,
): Promise<string[] | null> {
  if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return null
  const alt = (name: string) => name.replace(/\.[^.]+$/, '') || '图片'
  toast.info(files.length > 1 ? `正在插入 ${files.length} 张图片…` : '正在插入图片…')
  const {
    imageMode,
    assetsRoot,
    uploaderProvider,
    githubRepo,
    githubToken,
    picgoUrl,
  } = useEditorPrefs.getState()
  const useAssets = imageMode === 'assets'
  const useRemote = imageMode === 'remote'
  const uploaderConfig = { provider: uploaderProvider, githubRepo, githubToken, picgoUrl }
  // 绑定笔记落其目录 assets/(与 CM 版同规则);root 仅 assets 分支消费,
  // remote/embed 模式不去查平台默认根(免一次无用 IPC)
  const root = useAssets
    ? noteDir
      ? `${noteDir.replace(/[\\/]+$/, '')}\\assets`
      : assetsRoot.trim() || (await platformServices.files.defaultAssetsRoot())
    : ''
  const out: string[] = []
  let ok = 0
  for (const file of files) {
    try {
      const value = useAssets
        ? (await fileToAssetImage(file, root, platformServices.files.writeBinaryFile)).relativePath
        : useRemote
          ? await fileToUploadedImage(file, (bytes, name) =>
              platformServices.uploader.upload(uploaderConfig, bytes, name))
          : await fileToEmbeddedImage(file)
      out.push(`![${alt(file.name)}](${value})`)
      ok++
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `「${file.name}」处理失败`)
    }
  }
  if (ok) toast.success(`已插入 ${ok} 张图片`)
  return out
}
