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
  }
}
