import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { autoLineBreak } from '../shared/line-break'
import type { SubtitleCue, SubtitleLayoutCue, SubtitleStyleConfig } from '../shared/types'

export function buildSubtitleLayout(params: {
  cues: SubtitleCue[]
  style: SubtitleStyleConfig
  videoWidth: number
  measure: (text: string, fontSize: number) => number
}): SubtitleLayoutCue[] {
  const initialLayout = params.cues.map((cue) => ({
    ...cue,
    ...autoLineBreak({
      text: cue.text,
      style: params.style,
      videoWidth: params.videoWidth,
      measure: params.measure,
    }),
  }))

  if (!initialLayout.length) return initialLayout

  // A separate auto-fit decision for every cue makes the font visibly jump between
  // long and short subtitles. Pick the smallest size required by the timeline, then
  // reflow every cue at that shared size so typography stays stable across cuts.
  const sharedFontSize = Math.min(...initialLayout.map((cue) => cue.fontSize))
  if (initialLayout.every((cue) => cue.fontSize === sharedFontSize)) return initialLayout

  const sharedStyle = {
    ...params.style,
    fontSize: sharedFontSize,
    minFontSize: sharedFontSize,
  }

  return params.cues.map((cue) => ({
    ...cue,
    ...autoLineBreak({
      text: cue.text,
      style: sharedStyle,
      videoWidth: params.videoWidth,
      measure: params.measure,
    }),
  }))
}

// 由字幕时间轴驱动视觉输出，统一控制字重、描边、行高、安全区与位置，掌控字幕的画面表现。
export function renderSubtitleFrame(params: {
  root: Container
  cues: SubtitleLayoutCue[]
  style: SubtitleStyleConfig
  timeMs: number
  width: number
  height: number
}) {
  const { root, cues, style, timeMs, width, height } = params
  root.removeChildren().forEach((child) => child.destroy({ children: true }))
  const cue = cues.find((item) => timeMs >= item.startMs && timeMs < item.endMs)
  if (!cue) return

  const text = new Text({
    text: cue.lines.map((line) => line.text).join('\n'),
    style: new TextStyle({
      fontFamily: style.fontFamily,
      fontSize: cue.fontSize,
      fontWeight: style.fontWeight as any,
      fill: style.color,
      stroke: { color: style.strokeColor, width: style.strokeWidth },
      align: 'center',
      lineHeight: Math.round(cue.fontSize * style.lineHeight),
    }),
  })
  text.anchor.set(0.5, 1)
  text.x = width / 2 + style.offsetX
  const baseY =
    style.position === 'top'
      ? height * style.safeAreaBottomRatio + text.height
      : style.position === 'middle'
        ? height / 2 + text.height / 2
        : height * (1 - style.safeAreaBottomRatio)
  // Wider canvases reserve less room for social-app controls near the bottom edge.
  const aspectRatio = width / height
  const portraitLift = Math.max(0, Math.min(1, (1.3 - aspectRatio) / (1.3 - 9 / 16)))
  const positionScale = style.position === 'bottom' ? portraitLift : 1
  const verticalOffset = Math.round(style.offsetY * (height / 1920) * positionScale)
  text.y = baseY + verticalOffset
  if (style.backgroundColor) {
    const padding = cue.fontSize * 0.16
    const box = new Graphics()
      .rect(text.x - text.width / 2 - padding, text.y - text.height - padding, text.width + padding * 2, text.height + padding * 2)
      .fill({ color: style.backgroundColor, alpha: style.backgroundAlpha ?? 1 })
    root.addChild(box)
  }
  root.addChild(text)
}
