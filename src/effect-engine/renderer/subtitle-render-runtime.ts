import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { autoLineBreak } from '../shared/line-break'
import { getSubtitleAnimationFrame } from '../shared/subtitle-animation'
import type {
  SubtitleAnimation,
  SubtitleCue,
  SubtitleLayoutCue,
  SubtitleStyleConfig,
} from '../shared/types'

export function buildSubtitleLayout(params: {
  cues: SubtitleCue[]
  style: SubtitleStyleConfig
  videoWidth: number
  measure: (text: string, fontSize: number) => number
}): SubtitleLayoutCue[] {
  const layoutCue = (cue: SubtitleCue, style: SubtitleStyleConfig): SubtitleLayoutCue => {
    const layout = autoLineBreak({
      text: cue.text,
      style,
      videoWidth: params.videoWidth,
      measure: params.measure,
    })
    return {
      ...cue,
      ...layout,
      lines: layout.lines.map((line) => ({
        ...line,
        width: params.measure(line.text, layout.fontSize),
      })),
    }
  }

  const initialLayout = params.cues.map((cue) => layoutCue(cue, params.style))

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

  return params.cues.map((cue) => layoutCue(cue, sharedStyle))
}

interface CachedCaption {
  cue: SubtitleLayoutCue
  caption: Container
  textWidth: number
  textHeight: number
  background?: Graphics
  typewriterLines?: Text[]
}

const cachedCaptions = new WeakMap<Container, CachedCaption>()

function createCachedCaption(
  cue: SubtitleLayoutCue,
  style: SubtitleStyleConfig,
  animation: SubtitleAnimation,
): CachedCaption {
  const captionText = cue.lines.map((line) => line.text).join('\n')
  const textStyle = {
    fontFamily: style.fontFamily,
    fontSize: cue.fontSize,
    fontWeight: style.fontWeight as any,
    fill: style.color,
    stroke: { color: style.strokeColor, width: style.strokeWidth },
    lineHeight: Math.round(cue.fontSize * style.lineHeight),
  }
  const layoutText = new Text({
    text: captionText,
    style: new TextStyle({ ...textStyle, align: 'center' }),
  })
  const textWidth = layoutText.width
  const textHeight = layoutText.height
  const caption = new Container()
  let background: Graphics | undefined

  if (style.backgroundColor) {
    const padding = cue.fontSize * 0.16
    background = new Graphics()
      .rect(-textWidth / 2 - padding, -textHeight - padding, textWidth + padding * 2, textHeight + padding * 2)
      .fill({ color: style.backgroundColor, alpha: style.backgroundAlpha ?? 1 })
    caption.addChild(background)
  }

  let typewriterLines: Text[] | undefined
  if (animation === 'typewriter') {
    layoutText.destroy()
    const lineHeight = Math.round(cue.fontSize * style.lineHeight)
    typewriterLines = cue.lines.map((line, index) => {
      const lineText = new Text({
        text: '',
        style: new TextStyle({ ...textStyle, align: 'left' }),
      })
      lineText.anchor.set(0, 1)
      lineText.x = -line.width / 2
      lineText.y = -(cue.lines.length - index - 1) * lineHeight
      lineText.visible = false
      caption.addChild(lineText)
      return lineText
    })
  } else {
    layoutText.anchor.set(0.5, 1)
    layoutText.x = 0
    layoutText.y = 0
    caption.addChild(layoutText)
  }

  return { cue, caption, textWidth, textHeight, background, typewriterLines }
}

// 由字幕时间轴驱动视觉输出，统一控制字重、描边、行高、安全区与位置，掌控字幕的画面表现。
export function renderSubtitleFrame(params: {
  root: Container
  cues: SubtitleLayoutCue[]
  style: SubtitleStyleConfig
  animation?: SubtitleAnimation
  timeMs: number
  width: number
  height: number
}) {
  const { root, cues, style, animation = 'none', timeMs, width, height } = params
  const cue = cues.find((item) => timeMs >= item.startMs && timeMs < item.endMs)
  const previousCaption = cachedCaptions.get(root)
  if (!cue) {
    root.removeChildren().forEach((child) => child.destroy({ children: true }))
    cachedCaptions.delete(root)
    return
  }

  let cachedCaption = previousCaption
  if (!cachedCaption || cachedCaption.cue !== cue) {
    root.removeChildren().forEach((child) => child.destroy({ children: true }))
    cachedCaption = createCachedCaption(cue, style, animation)
    cachedCaptions.set(root, cachedCaption)
  }

  const animationFrame = getSubtitleAnimationFrame({
    animation,
    elapsedMs: Math.max(0, timeMs - cue.startMs),
    cueDurationMs: cue.endMs - cue.startMs,
    text: cue.lines.map((line) => line.text).join(''),
  })
  const centerX = width / 2 + style.offsetX
  const baseY =
    style.position === 'top'
      ? height * style.safeAreaBottomRatio + cachedCaption.textHeight
      : style.position === 'middle'
        ? height / 2 + cachedCaption.textHeight / 2
        : height * (1 - style.safeAreaBottomRatio)
  // Wider canvases reserve less room for social-app controls near the bottom edge.
  const aspectRatio = width / height
  const portraitLift = Math.max(0, Math.min(1, (1.3 - aspectRatio) / (1.3 - 9 / 16)))
  const positionScale = style.position === 'bottom' ? portraitLift : 1
  const verticalOffset = Math.round(style.offsetY * (height / 1920) * positionScale)
  cachedCaption.caption.position.set(
    centerX + animationFrame.horizontalOffsetRatio * width,
    baseY + verticalOffset + animationFrame.verticalOffsetProgress * height * 0.018,
  )
  cachedCaption.caption.alpha = animationFrame.opacity
  cachedCaption.caption.scale.set(animationFrame.scale)

  if (animation === 'typewriter') {
    if (cachedCaption.background) {
      cachedCaption.background.alpha = animationFrame.revealProgress
    }
    let remainingCharacters = animationFrame.visibleCharacters
    cue.lines.forEach((line, index) => {
      const characters = Array.from(line.text)
      const visibleText = characters.slice(0, remainingCharacters).join('')
      remainingCharacters = Math.max(0, remainingCharacters - characters.length)
      const lineText = cachedCaption?.typewriterLines?.[index]
      if (!lineText) return
      if (lineText.text !== visibleText) lineText.text = visibleText
      lineText.visible = Boolean(visibleText)
    })
  }

  if (root.children[0] !== cachedCaption.caption) {
    root.removeChildren()
    root.addChild(cachedCaption.caption)
  }
}
