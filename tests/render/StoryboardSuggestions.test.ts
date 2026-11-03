// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StoryboardSuggestions from '../../src/views/Home/components/StoryboardSuggestions.vue'

describe('分镜预览', () => {
  it('初始化预览范围、修改起点并在终点暂停', async () => {
    const wrapper = mount(StoryboardSuggestions, {
      props: {
        rows: [{ sentence: '介绍产品。', path: 'C:/素材/产品.mp4', description: '产品', timeSeconds: 2, startSeconds: 2, endSeconds: 2 }],
        materials: [{ path: 'C:/素材/产品.mp4', name: '产品.mp4' }],
        stale: false,
      },
    })
    const video = wrapper.get('video').element as HTMLVideoElement
    Object.defineProperty(video, 'duration', { value: 10, configurable: true })
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => {})
    await wrapper.get('video').trigger('loadedmetadata')
    expect(wrapper.emitted('timing')?.[0]).toEqual([0, 2, 5])
    await wrapper.setProps({ rows: [{ sentence: '介绍产品。', path: 'C:/素材/产品.mp4', description: '产品', startSeconds: 2, endSeconds: 5 }] })
    await wrapper.get('input').setValue('3')
    expect(wrapper.emitted('timing')?.at(-1)).toEqual([0, 3, 5])
    await wrapper.get('.timing button').trigger('click')
    expect(play).toHaveBeenCalledOnce()
    expect(video.currentTime).toBe(2)
    video.currentTime = 5
    await wrapper.get('video').trigger('timeupdate')
    expect(pause).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('文案或素材发生变化时提示重新生成', () => {
    const wrapper = mount(StoryboardSuggestions, { props: { rows: [], materials: [], stale: true } })
    expect(wrapper.get('[role="alert"]').text()).toContain('重新生成')
    wrapper.unmount()
  })
})
