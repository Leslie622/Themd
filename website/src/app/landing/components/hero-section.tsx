import { useState } from "react"
import { ArrowRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DotPattern } from "@/components/dot-pattern"
import { ImageStack } from "@/components/image-stack"
import { ImageLightbox } from "@/components/image-lightbox"
import { assetUrl } from "@/lib/utils"
import { useLang } from "@/lib/i18n/i18n-context"

const DOWNLOAD_URL = "https://github.com/Leslie622/Themd/releases"

export function HeroSection() {
  const { t } = useLang()
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-b from-background to-background/80 pt-16 sm:pt-20 pb-16"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" size="md" fadeStyle="ellipse" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-4xl text-center">
          {/* Main Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {t.hero.titlePre}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {" "}
              {t.hero.titleAccent}{" "}
            </span>
            {t.hero.titlePost}
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            {t.hero.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
            <Button
              size="lg"
              className="h-10 text-base leading-none cursor-pointer has-data-[icon=inline-start]:pl-2.5"
              nativeButton={false}
              render={<a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />}
            >
              <Download data-icon="inline-start" />
              {t.hero.download}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-10 text-base leading-none cursor-pointer"
              nativeButton={false}
              render={
                <a href="#features" onClick={(e) => {
                  e.preventDefault()
                  document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" })
                }} />
              }
            >
              {t.hero.explore}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>

        {/* Hero visual: stacked screenshot deck */}
        <div className="mx-auto mt-20 max-w-6xl">
          <div className="relative">
            {/* Top background glow effect - positioned above the deck */}
            <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>

            <ImageStack
              images={[
                { src: assetUrl("themd-hero-light.webp"), alt: t.hero.altLight },
                { src: assetUrl("themd-feature-editor.webp"), alt: t.features.altEditor },
                { src: assetUrl("themd-feature-studio.webp"), alt: t.features.altStudio },
                { src: assetUrl("themd-hero-light-lists.webp"), alt: t.hero.altLists },
                { src: assetUrl("themd-hero-light-code.webp"), alt: t.hero.altCode },
              ]}
              onOpen={setLightbox}
            />
          </div>
        </div>
      </div>

      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </section>
  )
}
