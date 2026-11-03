// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildSubtitleLayout } from '../../src/effect-engine/renderer/subtitle-render-runtime'
import type { SubtitleStyleConfig } from '../../src/effect-engine/shared/types'

const style: SubtitleStyleConfig = {
  position: 'bottom',
  offsetX: 0,
  offsetY: 0,
  safeAreaBottomRatio: 0.12,
  maxWidthRatio: 0.86,
  maxLines: 2,
  fontFamily: 'sans-serif',
  fontSize: 56,
  minFontSize: 34,
  fontWeight: '700',
  lineHeight: 1.24,
  color: '#FFFFFF',
  strokeColor: '#101010',
  strokeWidth: 4,
}

describe('subtitle layout typography', () => {
  it('uses one consistent font size across short and long cues', () => {
    const cues = buildSubtitleLayout({
      cues: [
        { id: 'short', text: 'Easy to install', startMs: 0, endMs: 1000 },
        {
          id: 'long',
          text: 'This all in one fresh air unit introduces outdoor air indoors',
          startMs: 1000,
          endMs: 4000,
        },
      ],
      style,
      videoWidth: 720,
      measure: (text, fontSize) => text.length * fontSize * 0.5,
    })

    expect(new Set(cues.map((cue) => cue.fontSize))).toHaveLength(1)
  })
})
