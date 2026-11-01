/**
 * 当前文档的序列化风格档案(infrastructure 层,可变单例)。
 * Bold/Italic 的 renderMarkdown 覆盖(在 tiptap-setup)与控制器序列化
 * 都要读它;放独立小模块避免 tiptap-setup ↔ markdown-engine 循环依赖。
 * 控制器在 parse/rebind 时写入。
 */
import { DEFAULT_PROFILE, type SerializeProfile } from '../domain/serialize-profile'

let active: SerializeProfile = DEFAULT_PROFILE

export function setActiveProfile(profile: SerializeProfile): void {
  active = profile
}

export function currentProfile(): SerializeProfile {
  return active
}
