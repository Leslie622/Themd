import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

export function EditorPane({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="h-full overflow-hidden text-sm">
      <CodeMirror
        value={value}
        onChange={onChange}
        height="100%"
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
      />
    </div>
  )
}
