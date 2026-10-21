import type { ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VerdictChip } from "@/components/praise/verdict-chip"
import { formatRelative, initials } from "@/lib/praise/format"
import type { PraiseAuthor, PraiseView } from "@/lib/praise/types"
import { SELF_PRAISE_LINE, verdictLine } from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

export function AuthorAvatar({ author, size = "default" }: { author: PraiseAuthor; size?: "sm" | "default" }) {
  return (
    <Avatar size={size}>
      {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
      <AvatarFallback className="bg-[var(--color-navy-lighter)] text-[var(--color-gold)]">
        {initials(author.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function PraiseQuote({ body, className }: { body: string; className?: string }) {
  return (
    <blockquote
      className={cn(
        "font-serif whitespace-pre-line break-words italic leading-relaxed text-foreground/90",
        className
      )}
    >
      {"\u201c"}
      {body}
      {"\u201d"}
    </blockquote>
  )
}

interface PraiseCardProps {
  praise: PraiseView
  now: number
  salaxeUserId: string | null
  isMine?: boolean
  title?: string | null
  children?: ReactNode
}

export function PraiseCard({ praise, now, salaxeUserId, isMine, title, children }: PraiseCardProps) {
  const selfPraise = !!salaxeUserId && praise.author.userId === salaxeUserId
  const remark = praise.verdict
    ? praise.verdictNote || verdictLine(praise.verdict, praise.id)
    : selfPraise
      ? SELF_PRAISE_LINE
      : null

  return (
    <article
      className={cn(
        "rounded-xl border bg-card/70 p-3 sm:p-4",
        praise.verdict === "crowned"
          ? "border-[var(--color-gold)]/40 shadow-md shadow-primary/10"
          : isMine
            ? "border-[var(--color-gold)]/25"
            : "border-border"
      )}
    >
      <header className="flex items-start gap-3">
        <AuthorAvatar author={praise.author} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {praise.author.name}
            {isMine && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {title && <span className="text-[var(--color-gold)]/80">{title} {"\u00b7"} </span>}
            <time dateTime={praise.createdAt}>{formatRelative(praise.createdAt, now)}</time>
          </p>
        </div>
        <VerdictChip verdict={praise.verdict} favor={praise.favor} selfPraise={selfPraise} className="mt-0.5" />
      </header>

      <PraiseQuote body={praise.body} className="mt-3 text-[15px]" />

      {remark && (
        <p
          className={cn(
            "mt-3 border-l-2 pl-2.5 text-xs leading-relaxed text-muted-foreground",
            praise.verdict === "scorned" ? "border-destructive/60" : "border-[var(--color-gold)]/50"
          )}
        >
          <span className="font-semibold text-[var(--color-gold)]">Salaxe: </span>
          {remark}
        </p>
      )}

      {children}
    </article>
  )
}
