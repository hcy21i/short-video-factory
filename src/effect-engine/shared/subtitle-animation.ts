import type { SubtitleAnimation } from './types'

export const subtitleAnimationOptions: ReadonlyArray<{
  titleKey: string
  value: SubtitleAnimation
}> = [
  { titleKey: 'features.render.config.animationNames.none', value: 'none' },
  { titleKey: 'features.render.config.animationNames.fade', value: 'fade' },
  { titleKey: 'features.render.config.animationNames.slideUp', value: 'slide-up' },
  { titleKey: 'features.render.config.animationNames.slideLeft', value: 'slide-left' },
  { titleKey: 'features.render.config.animationNames.slideRight', value: 'slide-right' },
  { titleKey: 'features.render.config.animationNames.pop', value: 'pop' },
  { titleKey: 'features.render.config.animationNames.zoomIn', value: 'zoom-in' },
  { titleKey: 'features.render.config.animationNames.typewriter', value: 'typewriter' },
  { titleKey: 'features.render.config.animationNames.fadeOut', value: 'fade-out' },
]

const ENTRANCE_DURATION_MS = 420
const MIN_TYPEWRITER_DURATION_MS = 280
const MAX_TYPEWRITER_DURATION_MS = 1400
const TYPEWRITER_CHARACTER_INTERVAL_MS = 45

export interface SubtitleAnimationFrame {
  opacity: number
  verticalOffsetProgress: number
  horizontalOffsetRatio: number
  scale: number
  visibleCharacters: number
  revealProgress: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3
}

function easeOutBack(progress: number) {
  const overshoot = 1.70158
  const curve = overshoot + 1
  return 1 + curve * (progress - 1) ** 3 + overshoot * (progress - 1) ** 2
}

export function getSubtitleAnimationFrame(params: {
  animation?: SubtitleAnimation
  elapsedMs: number
  cueDurationMs: number
  text: string
}): SubtitleAnimationFrame {
  const { animation = 'none', elapsedMs, cueDurationMs, text } = params
  const characterCount = Array.from(text).length
  const complete: SubtitleAnimationFrame = {
    opacity: 1,
    verticalOffsetProgress: 0,
    horizontalOffsetRatio: 0,
    scale: 1,
    visibleCharacters: characterCount,
    revealProgress: 1,
  }

  if (animation === 'none') return complete

  if (animation === 'typewriter') {
    const desiredDuration = clamp(
      characterCount * TYPEWRITER_CHARACTER_INTERVAL_MS,
      MIN_TYPEWRITER_DURATION_MS,
      MAX_TYPEWRITER_DURATION_MS,
    )
    const revealDuration = Math.max(1, Math.min(desiredDuration, cueDurationMs || desiredDuration))
    const revealProgress = clamp(elapsedMs / revealDuration, 0, 1)
    return {
      ...complete,
      visibleCharacters: Math.min(characterCount, Math.floor(characterCount * revealProgress)),
      revealProgress,
    }
  }

  if (animation === 'fade-out') {
    const fadeDuration = Math.max(1, Math.min(420, cueDurationMs * 0.28))
    const remainingMs = cueDurationMs - elapsedMs
    return { ...complete, opacity: clamp(remainingMs / fadeDuration, 0, 1) }
  }

  const entranceDuration = Math.max(1, Math.min(ENTRANCE_DURATION_MS, cueDurationMs * 0.6))
  const timeProgress = clamp(elapsedMs / entranceDuration, 0, 1)
  const progress = easeOutCubic(timeProgress)
  if (animation === 'fade') {
    return { ...complete, opacity: progress }
  }
  if (animation === 'slide-up') {
    return { ...complete, opacity: progress, verticalOffsetProgress: 1 - progress }
  }
  if (animation === 'slide-left') {
    return { ...complete, opacity: progress, horizontalOffsetRatio: -0.08 * (1 - progress) }
  }
  if (animation === 'slide-right') {
    return { ...complete, opacity: progress, horizontalOffsetRatio: 0.08 * (1 - progress) }
  }
  if (animation === 'pop') {
    return { ...complete, opacity: progress, scale: 0.84 + progress * 0.16 }
  }
  if (animation === 'zoom-in') {
    return { ...complete, opacity: progress, scale: 0.55 + easeOutBack(timeProgress) * 0.45 }
  }

  return complete
}
