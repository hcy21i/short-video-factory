// Adapted from OpenSubs presets.rs and advanced.rs, AGPL-3.0-or-later.
// See third_party/opensubs for the original files and license.
import type { SubtitleStyleConfig } from './shared/types'

type Preset = { name: string; label: string; size: number; color?: string; stroke?: string; outline?: number; margin?: number; position?: 'top' | 'middle' | 'bottom'; box?: string; alpha?: number; normal?: boolean; font?: string }
export const openSubsPresets: Preset[] = [
  { name: 'Clean', label: '简洁白字', size: 4.5 },
  { name: 'Bold', label: '醒目白字', size: 5.5, outline: 4 },
  { name: 'Boxed', label: '简洁底框', size: 4.5, outline: 0, box: '#000000', alpha: 180 / 255 },
  { name: 'Shorts', label: '竖屏安全区', size: 6.5, outline: 3, margin: 18 },
  { name: 'Caption', label: '新闻黄字', size: 4.5, color: '#FFD60A' },
  { name: 'CJK', label: '中日韩简洁字幕', size: 5, margin: 8, font: 'Noto Sans CJK SC' },
  { name: 'Neon', label: '霓虹青', size: 5.5, color: '#22F5DC', stroke: '#BE18A0', outline: 3.5 },
  { name: 'Podcast', label: '播客顶部条', size: 4.5, position: 'top', margin: 8, outline: 0, box: '#0C0C10', alpha: 178 / 255 },
  { name: 'Cinema', label: '电影感米白', size: 4, color: '#F5F0E4', outline: 1.5, margin: 9, normal: true },
  { name: 'Punch', label: '居中大字', size: 8.5, position: 'middle', margin: 0, outline: 5 },
  { name: 'Minimal', label: '极简深字', size: 4, color: '#101218', stroke: '#FFFFFF', outline: 1, normal: true },
  { name: 'Reel Box', label: '竖屏底框', size: 6, margin: 20, outline: 0, box: '#0C0C10', alpha: 178 / 255 },
]

export function resolveOpenSubsPreset(name: string, height: number): Partial<SubtitleStyleConfig> | undefined {
  const preset = openSubsPresets.find((item) => item.name === name)
  if (!preset) return undefined
  const fontSize = Math.round(height * preset.size / 100)
  return {
    position: preset.position ?? 'bottom', offsetX: 0, offsetY: 0,
    safeAreaBottomRatio: (preset.margin ?? 6) / 100,
    fontFamily: `"${preset.font ?? 'Inter'}", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`,
    fontSize, minFontSize: Math.round(fontSize * 0.65), fontWeight: preset.normal ? '400' : '700',
    color: preset.color ?? '#FFFFFF', strokeColor: preset.stroke ?? '#000000',
    strokeWidth: preset.outline ?? 2, backgroundColor: preset.box, backgroundAlpha: preset.alpha,
  }
}
