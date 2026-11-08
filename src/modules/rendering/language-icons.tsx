import { IconFileCode2 } from '@tabler/icons-react'

import { LANGUAGE_ALIAS_TO_CANON } from './code-highlight'
import { LANGUAGE_ICONS, type LangIconDef } from './language-icon-data'

/**
 * 代码块语言图标(语言选择浮层用):数据在 language-icon-data.tsx 单一来源。
 * 没有官方品牌图的语言用语义最近的品牌兜底(SQL→MySQL)/tabler 通用
 * IconFileCode2 兜底(灰色)。fence 语言值(小写)→ { Icon, color }。
 */
export function languageIcon(lang: string): LangIconDef {
  const lower = lang.toLowerCase()
  const aliased = LANGUAGE_ALIAS_TO_CANON[lower]
  return LANGUAGE_ICONS[aliased ?? lower] ?? { Icon: IconFileCode2, color: 'currentColor' }
}
