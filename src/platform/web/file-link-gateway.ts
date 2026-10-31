import type { FileLinkGateway } from '../contracts'

/**
 * Web 端 stub:浏览器沙箱无法读写任意本地路径、更无文件监听。
 * 库内笔记模式不受影响;文件绑定能力在 Web 端整体不可用。
 */
export function createWebFileLinkGateway(): FileLinkGateway {
  return {
    async readTextFile(path) {
      throw new Error(`浏览器端不支持读取本地文件: ${path}`)
    },
    async writeTextFile(path) {
      throw new Error(`浏览器端不支持写入本地文件: ${path}`)
    },
    async watchPaths() {
      // no-op:无监听能力
    },
    async onFsChanges() {
      return () => {}
    },
    async moveFile(src) {
      throw new Error(`浏览器端不支持移动本地文件: ${src}`)
    },
    async renameFile(src) {
      throw new Error(`浏览器端不支持重命名本地文件: ${src}`)
    },
    async trashFile(path) {
      throw new Error(`浏览器端不支持删除本地文件: ${path}`)
    },
    async renameDirectory(oldPath) {
      throw new Error(`浏览器端不支持重命名本地目录: ${oldPath}`)
    },
    async deleteDirectory(path) {
      throw new Error(`浏览器端不支持删除本地目录: ${path}`)
    },
    async uniqueDestination(dir, fileName) {
      void dir
      void fileName
      throw new Error('浏览器端不支持本地文件操作')
    },
  }
}
