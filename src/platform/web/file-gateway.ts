import type { FileGateway, ImportedFile, SavePathInput, SaveTextInput, SaveResult } from '../contracts'

const NOTE_EXTENSIONS = '.md,.markdown,.txt'

function selectFiles(options: { directory?: boolean }): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = NOTE_EXTENSIONS
    input.multiple = true
    if (options.directory) {
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
    }
    input.onchange = () => resolve(input.files)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export function createWebFileGateway(): FileGateway {
  return {
    async pickFiles() {
      const files = await selectFiles({})
      return files ? readBrowserFiles(files) : []
    },
    async pickFolder() {
      const files = await selectFiles({ directory: true })
      return files ? readBrowserFiles(files, true) : null
    },
    async chooseSavePath(input: SavePathInput) { void input; return null },
    async saveText(input: SaveTextInput): Promise<SaveResult> {
      void input
      return { kind: 'web' }
    },
    async pickDirectory() {
      // 浏览器无本地目录能力:本地图片模式在 Web 端被 UI 强制关闭,不应到达这里
      return null
    },
    async writeBinaryFile(path: string, bytes: Uint8Array) {
      void bytes
      throw new Error(`浏览器端不支持写入本地文件: ${path}`)
    },
    async defaultAssetsRoot() {
      return ''
    },
    async openPath(path: string) {
      void path
      throw new Error('浏览器端不支持打开本地文件')
    },
    async revealItemInDir(path: string) {
      void path
      throw new Error('浏览器端不支持打开本地文件')
    },
  }
}

export function readBrowserFiles(files: FileList, preserveFolders = false): Promise<ImportedFile[]> {
  return Promise.all(
    Array.from(files)
      .filter((file) => /\.(md|markdown|txt)$/i.test(file.name))
      .map(async (file) => {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? ''
        const parts = relativePath.split('/').filter(Boolean)
        parts.pop()
        return {
          folderPath: preserveFolders ? parts.join('/') : '',
          title: file.name.replace(/\.(md|markdown|txt)$/i, ''),
          content: await file.text(),
        }
      }),
  )
}
