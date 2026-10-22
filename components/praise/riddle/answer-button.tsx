import { Loader2Icon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RIDDLE_COPY } from "@/lib/praise/voice"

export function AnswerButton({ ready, pending, onClick }: { ready: boolean; pending: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={!ready || pending}
      className="h-12 w-full gap-2 text-base font-semibold shadow-lg shadow-primary/20"
    >
      {pending ? (
        <>
          <Loader2Icon className="animate-spin" aria-hidden />
          {RIDDLE_COPY.answering}
        </>
      ) : (
        <>
          <SparklesIcon aria-hidden />
          {RIDDLE_COPY.answer}
        </>
      )}
    </Button>
  )
}

// A radio styled as a big tappable tile: native arrow-key navigation, visible focus, 48px or more.
export const OPTION_TILE =
  "relative flex cursor-pointer items-center justify-center rounded-xl border border-[var(--color-gold)]/20 bg-[var(--color-navy)]/60 text-[var(--color-gold-light)] transition-[border-color,background-color,box-shadow,transform] duration-150 select-none hover:border-[var(--color-gold)]/50 hover:bg-[var(--color-gold)]/10 active:translate-y-px has-[input:checked]:border-[var(--color-gold)] has-[input:checked]:bg-[var(--color-gold)]/18 has-[input:checked]:shadow-glow-gold has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 has-[input:disabled]:cursor-default has-[input:disabled]:opacity-60 motion-reduce:transition-none"
