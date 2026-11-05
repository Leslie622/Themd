import * as React from "react"
import { dictionaries, type Dict, type Lang } from "./dictionaries"

type LangProviderContextType = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Dict
}

const LangProviderContext = React.createContext<LangProviderContextType>({
  lang: "zh",
  setLang: () => {},
  t: dictionaries.zh,
})

function detectInitialLang(storageKey: string): Lang {
  const saved = localStorage.getItem(storageKey)
  if (saved === "zh" || saved === "en") return saved
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export function LangProvider({
  children,
  storageKey = "themd-website-ui-lang",
}: {
  children: React.ReactNode
  storageKey?: string
}) {
  const [lang, setLang] = React.useState<Lang>(() =>
    detectInitialLang(storageKey)
  )

  React.useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"
  }, [lang])

  const value = {
    lang,
    setLang: (newLang: Lang) => {
      localStorage.setItem(storageKey, newLang)
      setLang(newLang)
    },
    t: dictionaries[lang],
  }

  return (
    <LangProviderContext.Provider value={value}>
      {children}
    </LangProviderContext.Provider>
  )
}

export const useLang = () => React.useContext(LangProviderContext)
