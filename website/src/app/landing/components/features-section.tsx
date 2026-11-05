import {
  Eye,
  Columns2,
  FileText,
  ListTree,
  Save,
  Lightbulb,
  MousePointerClick,
  ArrowLeftRight,
  UserX,
  WifiOff,
  Trash2,
  Search,
  ImagePlus,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Image3D } from "@/components/image-3d"
import { ImageLightbox } from "@/components/image-lightbox"
import { assetUrl } from "@/lib/utils"
import { useLang } from "@/lib/i18n/i18n-context"

const mainFeatureIcons = [Eye, Columns2, ListTree, Save, Search, ImagePlus]
const secondaryFeatureIcons = [Lightbulb, MousePointerClick, ArrowLeftRight, FileText]
const localBadgeIcons = [UserX, WifiOff, Trash2]

export function FeaturesSection() {
  const { t } = useLang()
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  return (
    <section id="features" className="py-24 sm:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            {t.features.title}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t.features.subtitle}
          </p>
        </div>

        {/* First Feature Section */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Content */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t.features.viewsTitle}
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                {t.features.viewsDescription}
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {t.features.mainFeatures.map((feature, index) => {
                const Icon = mainFeatureIcons[index]
                return (
                  <li
                    key={feature.title}
                    className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors"
                  >
                    <div className="mt-0.5 flex shrink-0 items-center justify-center">
                      <Icon className="size-5 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-foreground font-medium">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Right Image */}
          <Image3D
            lightSrc={assetUrl("themd-feature-editor.webp")}
            darkSrc={assetUrl("themd-feature-editor.webp")}
            alt={t.features.altEditor}
            direction="right"
            onOpen={(src, alt) => setLightbox({ src, alt })}
          />
        </div>

        {/* Second Feature Section - Flipped Layout */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Image */}
          <Image3D
            lightSrc={assetUrl("themd-feature-studio.webp")}
            darkSrc={assetUrl("themd-feature-studio.webp")}
            alt={t.features.altStudio}
            direction="left"
            className="order-2 lg:order-1"
            onOpen={(src, alt) => setLightbox({ src, alt })}
          />

          {/* Right Content */}
          <div className="flex flex-col gap-6 order-1 lg:order-2">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t.features.studioTitle}
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                {t.features.studioDescription}
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {t.features.secondaryFeatures.map((feature, index) => {
                const Icon = secondaryFeatureIcons[index]
                return (
                  <li
                    key={feature.title}
                    className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors"
                  >
                    <div className="mt-0.5 flex shrink-0 items-center justify-center">
                      <Icon className="size-5 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-foreground font-medium">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Third Feature Section - Export formats */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Content */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t.features.exportTitle}
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                {t.features.exportDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {t.features.exportFormats.map((format) => (
                <Badge key={format} variant="outline" className="px-3 py-1">
                  {format}
                </Badge>
              ))}
            </div>
          </div>

          {/* Right Image */}
          <Image3D
            lightSrc={assetUrl("themd-feature-export.webp")}
            darkSrc={assetUrl("themd-feature-export.webp")}
            alt={t.features.altExport}
            direction="right"
            onOpen={(src, alt) => setLightbox({ src, alt })}
          />
        </div>

        {/* Fourth Feature Section - Image lightbox */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Image */}
          <Image3D
            lightSrc={assetUrl("themd-feature-lightbox.webp")}
            darkSrc={assetUrl("themd-feature-lightbox.webp")}
            alt={t.features.altLightbox}
            direction="left"
            className="order-2 lg:order-1"
            onOpen={(src, alt) => setLightbox({ src, alt })}
          />

          {/* Right Content */}
          <div className="flex flex-col gap-6 order-1 lg:order-2">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t.features.lightboxTitle}
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                {t.features.lightboxDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {t.features.lightboxFeatures.map((feature) => (
                <Badge key={feature} variant="outline" className="px-3 py-1">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Fifth Feature Section - Image bed uploader */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          {/* Left Content */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {t.features.uploaderTitle}
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                {t.features.uploaderDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {t.features.uploaderChips.map((chip) => (
                <Badge key={chip} variant="outline" className="px-3 py-1">
                  {chip}
                </Badge>
              ))}
            </div>
          </div>

          {/* Right Image */}
          <Image3D
            lightSrc={assetUrl("themd-feature-uploader.webp")}
            darkSrc={assetUrl("themd-feature-uploader.webp")}
            alt={t.features.altUploader}
            direction="right"
            onOpen={(src, alt) => setLightbox({ src, alt })}
          />
        </div>

        {/* Local-first strip */}
        <div className="grid gap-6 sm:grid-cols-3">
          {t.features.localBadges.map((item, index) => {
            const Icon = localBadgeIcons[index]
            return (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-xl border bg-card p-6"
              >
                <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {item.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </section>
  )
}
