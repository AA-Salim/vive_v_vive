import type { QueryClient, QueryKey } from "@tanstack/react-query"
import type { LiveTarget } from "@/lib/live/events"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUserScoped = (key: QueryKey) => typeof key[1] === "string" && UUID.test(key[1])

// Collects invalidation targets for a few milliseconds so a burst of events (or of row changes)
// triggers one refetch per query instead of one per event. Flushes are also spaced by minGapMs:
// a game resolution streams dozens of row changes, and back-to-back flushes would cancel and
// restart the same in-flight requests over and over.
export class InvalidationQueue {
  private pending: LiveTarget[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastFlushAt = 0

  constructor(
    private readonly client: QueryClient,
    private readonly delayMs = 60,
    private readonly minGapMs = 350
  ) {}

  push(targets: LiveTarget[]): void {
    if (targets.length === 0) return
    this.pending.push(...targets)
    if (this.timer) return
    const wait = Math.max(this.delayMs, this.lastFlushAt + this.minGapMs - Date.now())
    this.timer = setTimeout(() => this.flush(), wait)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const targets = this.pending
    this.pending = []
    if (targets.length === 0) return
    this.lastFlushAt = Date.now()
    const whole = new Set<string>()
    const scoped = new Map<string, Set<string>>()
    for (const target of targets) {
      if (!target.userId) {
        whole.add(target.root)
        continue
      }
      const users = scoped.get(target.root) ?? new Set<string>()
      users.add(target.userId)
      scoped.set(target.root, users)
    }
    whole.forEach((root) => this.client.invalidateQueries({ queryKey: [root] }))
    scoped.forEach((users, root) => {
      if (whole.has(root)) return
      this.client.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === root && (!isUserScoped(query.queryKey) || users.has(query.queryKey[1] as string)),
      })
    })
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.pending = []
  }
}

export class SeenIds {
  private ids = new Set<string>()

  constructor(private readonly max = 600) {}

  // Returns false when the id was already seen.
  add(id: string): boolean {
    if (this.ids.has(id)) return false
    this.ids.add(id)
    if (this.ids.size > this.max) {
      const oldest = this.ids.values().next().value
      if (oldest !== undefined) this.ids.delete(oldest)
    }
    return true
  }
}
