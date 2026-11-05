import { describe, expect, it } from 'vitest'
import { openSubsPresets, resolveOpenSubsPreset } from '../../src/effect-engine/opensubs-presets'

describe('OpenSubs presets', () => {
  it('provides all twelve unique styles and keeps the original default available', () => {
    expect(openSubsPresets).toHaveLength(12)
    expect(new Set(openSubsPresets.map((item) => item.name)).size).toBe(12)
    expect(resolveOpenSubsPreset('', 1920)).toBeUndefined()
  })

  it('scales text to video height and maps top, center and boxed styles', () => {
    expect(resolveOpenSubsPreset('Shorts', 1000)).toMatchObject({ fontSize: 65, safeAreaBottomRatio: 0.18 })
    expect(resolveOpenSubsPreset('Podcast', 1000)).toMatchObject({ position: 'top', backgroundColor: '#0C0C10' })
    expect(resolveOpenSubsPreset('Punch', 1000)).toMatchObject({ position: 'middle', fontSize: 85 })
    expect(resolveOpenSubsPreset('Caption', 1000)).toMatchObject({ color: '#FFD60A' })
  })
})
