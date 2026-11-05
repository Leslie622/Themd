import { ThemeProvider } from "@/components/theme-provider"
import LandingPage from "@/app/landing/page"

function App() {
  return (
    <div
      className="font-sans antialiased"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <ThemeProvider defaultTheme="system" storageKey="themd-website-ui-theme">
        <LandingPage />
      </ThemeProvider>
    </div>
  )
}

export default App
