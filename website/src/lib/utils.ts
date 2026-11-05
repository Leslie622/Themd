// shadcn's class-name merger (clsx + tailwind-merge in one compiled package)
export { cn } from "cn"

/**
 * Get the correct URL for public assets
 * Handles both development and production asset paths
 */
export function assetUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL || "/"
  const cleanPath = path.startsWith("/") ? path.slice(1) : path
  return baseUrl + cleanPath
}
