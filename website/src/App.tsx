import { ThemeProvider } from "@/components/theme-provider"
import { LangProvider } from "@/lib/i18n/i18n-context"
import LandingPage from "@/app/landing/page"

function App() {
  return (
    <div
      className="font-sans antialiased"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <ThemeProvider defaultTheme="system" storageKey="themd-website-ui-theme">
        <LangProvider storageKey="themd-website-ui-lang">
          <LandingPage />
        </LangProvider>
      </ThemeProvider>
    </div>
  )
}

export default App
