import { beforeEach, describe, expect, it, vi } from 'vitest'

const pixiState = vi.hoisted(() => ({ textObjectsCreated: 0 }))

vi.mock('pixi.js', () => {
  class Container {
    children: Container[] = []
    alpha = 1
    visible = true
    x = 0
    y = 0
    position = { set: (x: number, y: number) => { this.x = x; this.y = y } }
    scale = { set: (_x: number, _y?: number) => undefined }
    anchor = { set: (_x: number, _y?: number) => undefined }

    addChild<T extends Container>(child: T) {
      this.children.push(child)
      return child
    }

    removeChildren() {
      const children = this.children
      this.children = []
      return children
    }

    destroy() {
      this.children = []
    }
  }

  class Graphics extends Container {
    rect() { return this }
    fill() { return this }
  }

  class Text extends Container {
    width: number
    height = 48

    constructor(options: { text: string }) {
      super()
      pixiState.textObjectsCreated += 1
      this.text = options.text
      this.width = options.text.length * 20
    }

    text: string
  }

  class TextStyle {
    constructor(_options: Record<string, unknown>) {}
  }

  return { Container, Graphics, Text, TextStyle }
})

import { Container, Text } from 'pixi.js'
import { renderSubtitleFrame } from '../../src/effect-engine/renderer/subtitle-render-runtime'
import type { SubtitleLayoutCue, SubtitleStyleConfig } from '../../src/effect-engine/shared/types'

const style: SubtitleStyleConfig = {
  position: 'bottom',
  offsetX: 0,
  offsetY: 0,
  safeAreaBottomRatio: 0.06,
  maxWidthRatio: 0.9,
  maxLines: 2,
  fontFamily: 'Arial',
  fontSize: 40,
  minFontSize: 24,
  fontWeight: '700',
  lineHeight: 1.2,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 2,
  backgroundColor: '#000000',
  backgroundAlpha: 0.6,
}

const cue: SubtitleLayoutCue = {
  id: 'cue-1',
  startMs: 0,
  endMs: 1000,
  text: '你好世界',
  fontSize: 40,
  lines: [{ text: '你好世界', width: 80 }],
}

describe('subtitle frame runtime', () => {
  beforeEach(() => {
    pixiState.textObjectsCreated = 0
  })

  it('reuses typewriter text objects across frames', () => {
    const root = new Container()
    const frame = (timeMs: number) => renderSubtitleFrame({
      root,
      cues: [cue],
      style,
      animation: 'typewriter',
      timeMs,
      width: 1080,
      height: 1920,
    })

    frame(100)
    const caption = root.children[0]
    const typewriterLine = caption.children[1] as Text
    const createdOnFirstFrame = pixiState.textObjectsCreated
    expect(typewriterLine.text).toBe('你')

    frame(200)

    expect(root.children[0]).toBe(caption)
    expect(caption.children[1]).toBe(typewriterLine)
    expect(typewriterLine.text).toBe('你好')
    expect(pixiState.textObjectsCreated).toBe(createdOnFirstFrame)
  })
})
