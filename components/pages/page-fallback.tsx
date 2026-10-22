import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Shown while a page that reads its season from the URL hydrates.
export function PageFallback({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto max-w-6xl space-y-5", className)} aria-busy="true">
      <Skeleton className="h-20 w-full max-w-md" />
      <Skeleton className="h-12 w-full max-w-72 rounded-xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  )
}
