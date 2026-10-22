import type { LiveTone } from "@/lib/live/tone"

type AudioContextCtor = typeof AudioContext

// big: a game moment worth looking up for. small: a soft tick for everyday news. personal: a bell, aimed at you.
export type CueSize = "big" | "small" | "personal"

interface Voice {
  at: number
  freq: number
  dur: number
  gain: number
  type?: OscillatorType
  // Pitch at the end of the note, as a ratio of the start (a slide).
  glide?: number
  // Extra sine partials (ratio of the base frequency) for bell-like timbres.
  partials?: number[]
  // Low-pass cutoff for the brassy voices.
  cutoff?: number
}

const C4 = 261.63
const note = (semitones: number) => C4 * 2 ** (semitones / 12)
const [A3, C5, E5, G4, G5, Ab4, A4, Bb4, B5, C6, E6, G6] = [-3, 12, 16, 7, 19, 8, 9, 10, 23, 24, 28, 31].map(note)

const BIG: Record<LiveTone, Voice[]> = {
  info: [
    { at: 0, freq: G5, dur: 0.3, gain: 0.08, type: "sine" },
    { at: 0.11, freq: C6, dur: 0.42, gain: 0.08, type: "sine" },
  ],
  hype: [
    { at: 0, freq: C5, dur: 0.18, gain: 0.07, type: "triangle" },
    { at: 0.07, freq: E5, dur: 0.18, gain: 0.07, type: "triangle" },
    { at: 0.14, freq: G5, dur: 0.2, gain: 0.07, type: "triangle" },
    { at: 0.21, freq: C6, dur: 0.55, gain: 0.08, type: "triangle", partials: [2] },
  ],
  royal: [
    { at: 0, freq: G4, dur: 0.13, gain: 0.05, type: "sawtooth", cutoff: 1900 },
    { at: 0.15, freq: G4, dur: 0.13, gain: 0.05, type: "sawtooth", cutoff: 1900 },
    { at: 0.3, freq: C5, dur: 0.7, gain: 0.055, type: "sawtooth", cutoff: 2200 },
    { at: 0.3, freq: E5, dur: 0.7, gain: 0.035, type: "triangle" },
    { at: 0.3, freq: G5, dur: 0.7, gain: 0.03, type: "triangle" },
  ],
  roast: [
    { at: 0, freq: Bb4, dur: 0.24, gain: 0.08, type: "triangle", glide: 0.97, cutoff: 1500 },
    { at: 0.27, freq: A4, dur: 0.24, gain: 0.08, type: "triangle", glide: 0.97, cutoff: 1500 },
    { at: 0.54, freq: Ab4, dur: 0.55, gain: 0.08, type: "triangle", glide: 0.93, cutoff: 1300 },
  ],
  danger: [
    { at: 0, freq: A3, dur: 0.16, gain: 0.06, type: "square", cutoff: 900 },
    { at: 0, freq: A3 * 1.5, dur: 0.16, gain: 0.035, type: "square", cutoff: 900 },
    { at: 0.2, freq: A3, dur: 0.22, gain: 0.06, type: "square", cutoff: 900 },
    { at: 0.2, freq: A3 * 1.5, dur: 0.22, gain: 0.035, type: "square", cutoff: 900 },
  ],
}

const SMALL: Record<LiveTone, Voice[]> = {
  info: [{ at: 0, freq: E6, dur: 0.14, gain: 0.04, type: "sine" }],
  hype: [
    { at: 0, freq: G5, dur: 0.1, gain: 0.035, type: "sine" },
    { at: 0.06, freq: C6, dur: 0.16, gain: 0.04, type: "sine" },
  ],
  royal: [{ at: 0, freq: C6, dur: 0.22, gain: 0.04, type: "sine", partials: [1.5] }],
  roast: [{ at: 0, freq: Bb4, dur: 0.16, gain: 0.05, type: "triangle", glide: 0.9 }],
  danger: [{ at: 0, freq: A4, dur: 0.18, gain: 0.045, type: "triangle", glide: 0.94 }],
}

const BELL: Voice[] = [
  { at: 0, freq: B5, dur: 0.9, gain: 0.07, type: "sine", partials: [2.76, 5.4] },
  { at: 0.14, freq: E6, dur: 1.1, gain: 0.075, type: "sine", partials: [2.76, 5.4] },
  { at: 0.14, freq: G6 / 2, dur: 0.6, gain: 0.025, type: "triangle" },
]

const SMALL_GAP_MS = 1_200
const BIG_GAP_MS = 350

let audio: AudioContext | null = null
let output: AudioNode | null = null
let lastCueAt = 0

function audioCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

function outputOf(ctx: AudioContext): AudioNode {
  if (output) return output
  const master = ctx.createGain()
  master.gain.value = 2.2
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -12
  limiter.ratio.value = 6
  master.connect(limiter).connect(ctx.destination)
  output = master
  return master
}

// Browsers only start audio after a user gesture: call this from a click/keydown handler. Cheap to call often.
// Resolves once the output is running.
export function primeAudio(): Promise<boolean> {
  const Ctor = audioCtor()
  if (!Ctor) return Promise.resolve(false)
  try {
    if (!audio) {
      audio = new Ctor()
      // iOS unlocks the output only once something played inside the gesture: one silent sample.
      const unlock = audio.createBufferSource()
      unlock.buffer = audio.createBuffer(1, 1, 22_050)
      unlock.connect(audio.destination)
      unlock.start(0)
    }
    const ctx = audio
    if (ctx.state === "running") return Promise.resolve(true)
    return ctx.resume().then(
      () => audioReady(),
      () => false
    )
  } catch {
    audio = null
    output = null
    return Promise.resolve(false)
  }
}

export function audioReady(): boolean {
  return !!audio && audio.state === "running"
}

function play(ctx: AudioContext, voices: Voice[]) {
  const out = outputOf(ctx)
  const start = ctx.currentTime + 0.02
  for (const voice of voices) {
    const at = start + voice.at
    const end = at + voice.dur
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(voice.gain, at + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, end)
    let sink: AudioNode = env
    if (voice.cutoff) {
      const filter = ctx.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.value = voice.cutoff
      filter.Q.value = 0.7
      filter.connect(env)
      sink = filter
    }
    env.connect(out)
    const ratios = [1, ...(voice.partials ?? [])]
    ratios.forEach((ratio, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? (voice.type ?? "sine") : "sine"
      osc.frequency.setValueAtTime(voice.freq * ratio, at)
      if (voice.glide) osc.frequency.exponentialRampToValueAtTime(voice.freq * ratio * voice.glide, end)
      if (i === 0) {
        osc.connect(sink)
      } else {
        const partial = ctx.createGain()
        partial.gain.value = 0.35 / i
        osc.connect(partial).connect(sink)
      }
      osc.start(at)
      osc.stop(end + 0.05)
    })
  }
}

export function playCue(tone: LiveTone, size: CueSize = "big"): boolean {
  if (!audio || audio.state !== "running") return false
  const now = Date.now()
  if (now - lastCueAt < (size === "small" ? SMALL_GAP_MS : BIG_GAP_MS)) return false
  lastCueAt = now
  try {
    play(audio, size === "personal" ? BELL : size === "small" ? SMALL[tone] : BIG[tone])
    return true
  } catch {
    return false
  }
}

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
}

export function buzz(tone: LiveTone): boolean {
  if (!canVibrate()) return false
  try {
    return navigator.vibrate(tone === "danger" ? [90, 60, 90, 60, 90] : tone === "hype" ? [60, 40, 120] : [70])
  } catch {
    return false
  }
}
