// @vitest-environment jsdom
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SubtitlePresetPicker from '../../src/views/Home/components/SubtitlePresetPicker.vue'

vi.mock('i18next-vue', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe('subtitle animation preview lifecycle', () => {
  it('pauses animation frames while the export page is hidden', async () => {
    const requestFrame = vi.fn(() => 7)
    const cancelFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)

    const wrapper = shallowMount(SubtitlePresetPicker, {
      props: {
        modelValue: '',
        animation: 'fade',
        previewActive: false,
      },
      global: {
        stubs: {
          VSelect: true,
          VBtn: true,
          VDialog: true,
          VCard: true,
          VDivider: true,
          VIcon: true,
        },
      },
    })

    try {
      expect(requestFrame).not.toHaveBeenCalled()

      await wrapper.setProps({ previewActive: true })
      expect(requestFrame).toHaveBeenCalledTimes(1)

      await wrapper.setProps({ previewActive: false })
      expect(cancelFrame).toHaveBeenCalledWith(7)
    } finally {
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })
})
