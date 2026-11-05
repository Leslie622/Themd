import { Button } from "@/components/ui/button"
import { useLang } from "@/lib/i18n/i18n-context"

interface LanguageToggleProps {
  variant?: "outline" | "ghost" | "default"
}

export function LanguageToggle({ variant = "ghost" }: LanguageToggleProps) {
  const { lang, setLang, t } = useLang()

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="cursor-pointer text-xs font-semibold"
      aria-label={t.common.langToggle}
      title={t.common.langToggle}
    >
      <span aria-hidden>{lang === "zh" ? "EN" : "中"}</span>
      <span className="sr-only">{t.common.langToggle}</span>
    </Button>
  )
}
