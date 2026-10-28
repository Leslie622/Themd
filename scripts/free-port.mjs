/**
 * tauri:dev 前置:释放 1420 端口。
 * Tauri 要求 dev 服务器固定占 1420(strictPort),上一次 dev 会话没退干净时,
 * 孤儿 vite 会占住端口导致下次启动直接失败。这里检测占用并结束持有者——
 * 1420 是本项目专属端口,持有者只可能是我们自己的残留 vite,杀掉无副作用。
 */
import { execSync } from 'node:child_process'

const PORT = 1420

function listeners() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split('\n')) {
      if (line.includes(`:${PORT} `) && line.includes('LISTENING')) {
        const pid = Number.parseInt(line.trim().split(/\s+/).at(-1), 10)
        if (Number.isInteger(pid) && pid > 0) pids.add(pid)
      }
    }
    return [...pids]
  } catch {
    return []
  }
}

const pids = listeners()
if (pids.length === 0) {
  console.log(`[free-port] ${PORT} 端口空闲`)
  process.exit(0)
}

for (const pid of pids) {
  try {
    process.kill(pid)
    console.log(`[free-port] 已结束残留进程 ${pid}(占用 ${PORT} 端口)`)
  } catch (e) {
    console.warn(`[free-port] 结束进程 ${pid} 失败:${e.message}(若再次报端口占用请手动关闭)`)
  }
}

// 给系统一点时间释放句柄
const deadline = Date.now() + 5000
while (Date.now() < deadline) {
  if (listeners().length === 0) {
    console.log(`[free-port] ${PORT} 端口已释放`)
    process.exit(0)
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
}
console.error(`[free-port] ${PORT} 端口仍被占用,请手动处理`)
process.exit(1)
