import { describe, expect, it } from 'vitest'
import { getSubtitleAnimationFrame, subtitleAnimationOptions } from '../../src/effect-engine/shared/subtitle-animation'
import {
  getSubtitleRenderFrameCount,
  MAX_MCP_RENDER_DURATION_SECONDS,
  validateMcpRenderDuration,
} from '../../src/effect-engine/shared/render-limits'

describe('subtitle animation frames', () => {
  it('bounds MCP duration and subtitle frame allocation', () => {
    expect(validateMcpRenderDuration(MAX_MCP_RENDER_DURATION_SECONDS)).toBe(
      MAX_MCP_RENDER_DURATION_SECONDS,
    )
    expect(() => validateMcpRenderDuration(MAX_MCP_RENDER_DURATION_SECONDS + 0.1)).toThrow()
    expect(getSubtitleRenderFrameCount(10_000, 30)).toBe(300)
    expect(() => getSubtitleRenderFrameCount(1_000_000, 30)).toThrow()
    expect(() => getSubtitleRenderFrameCount(Number.POSITIVE_INFINITY, 30)).toThrow()
  })

  it('exposes the UI animation options used by the renderer', () => {
    expect(subtitleAnimationOptions.map((option) => option.value)).toEqual([
      'none',
      'fade',
      'slide-up',
      'slide-left',
      'slide-right',
      'pop',
      'zoom-in',
      'typewriter',
      'fade-out',
    ])
  })

  it('fades and slides captions into their settled state', () => {
    const fadeStart = getSubtitleAnimationFrame({
      animation: 'fade',
      elapsedMs: 0,
      cueDurationMs: 2000,
      text: '字幕',
    })
    const slideStart = getSubtitleAnimationFrame({
      animation: 'slide-up',
      elapsedMs: 0,
      cueDurationMs: 2000,
      text: '字幕',
    })
    const slideEnd = getSubtitleAnimationFrame({
      animation: 'slide-up',
      elapsedMs: 420,
      cueDurationMs: 2000,
      text: '字幕',
    })

    expect(fadeStart.opacity).toBe(0)
    expect(slideStart.opacity).toBe(0)
    expect(slideStart.verticalOffsetProgress).toBe(1)
    expect(slideEnd).toMatchObject({ opacity: 1, verticalOffsetProgress: 0 })
  })

  it('slides from the selected horizontal side and settles at the center', () => {
    const slideLeft = getSubtitleAnimationFrame({
      animation: 'slide-left',
      elapsedMs: 0,
      cueDurationMs: 2000,
      text: '字幕',
    })
    const slideRight = getSubtitleAnimationFrame({
      animation: 'slide-right',
      elapsedMs: 0,
      cueDurationMs: 2000,
      text: '字幕',
    })
    const settled = getSubtitleAnimationFrame({
      animation: 'slide-right',
      elapsedMs: 420,
      cueDurationMs: 2000,
      text: '字幕',
    })

    expect(slideLeft.horizontalOffsetRatio).toBeLessThan(0)
    expect(slideRight.horizontalOffsetRatio).toBeGreaterThan(0)
    expect(settled.horizontalOffsetRatio).toBe(0)
    expect(settled.opacity).toBe(1)
  })

  it('gives zoom-in a small overshoot and returns to its final size', () => {
    const entering = getSubtitleAnimationFrame({
      animation: 'zoom-in',
      elapsedMs: 300,
      cueDurationMs: 2000,
      text: '字幕',
    })
    const settled = getSubtitleAnimationFrame({
      animation: 'zoom-in',
      elapsedMs: 420,
      cueDurationMs: 2000,
      text: '字幕',
    })

    expect(entering.scale).toBeGreaterThan(1)
    expect(settled.scale).toBe(1)
  })

  it('reveals Unicode characters in order and finishes within a short cue', () => {
    const halfway = getSubtitleAnimationFrame({
      animation: 'typewriter',
      elapsedMs: 50,
      cueDurationMs: 100,
      text: '你😀好',
    })
    const complete = getSubtitleAnimationFrame({
      animation: 'typewriter',
      elapsedMs: 100,
      cueDurationMs: 100,
      text: '你😀好',
    })

    expect(halfway.visibleCharacters).toBe(1)
    expect(complete.visibleCharacters).toBe(3)
  })

  it('fades the caption during the final part of its cue', () => {
    const beforeExit = getSubtitleAnimationFrame({
      animation: 'fade-out',
      elapsedMs: 1500,
      cueDurationMs: 2000,
      text: '字幕',
    })
    const halfwayThroughExit = getSubtitleAnimationFrame({
      animation: 'fade-out',
      elapsedMs: 1790,
      cueDurationMs: 2000,
      text: '字幕',
    })
    const cueEnd = getSubtitleAnimationFrame({
      animation: 'fade-out',
      elapsedMs: 2000,
      cueDurationMs: 2000,
      text: '字幕',
    })

    expect(beforeExit.opacity).toBe(1)
    expect(halfwayThroughExit.opacity).toBe(0.5)
    expect(cueEnd.opacity).toBe(0)
  })
})
