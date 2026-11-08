import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = React.createContext<ThemeProviderContextType>({
  theme: "system",
  setTheme: () => {},
})

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "themd-website-ui-theme",
  ...props
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const [theme, setTheme] = React.useState<Theme>(
    () =>
      (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => React.useContext(ThemeProviderContext)
