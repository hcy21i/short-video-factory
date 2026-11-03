import { describe, expect, it } from 'vitest'
import { parseVideoImportUrl } from '../../electron/lib/video-import-url'

describe('视频链接识别', () => {
  it.each([
    ['https://v.douyin.com/example/', 'douyin'],
    ['https://www.tiktok.com/@user/video/123', 'tiktok'],
    ['https://youtu.be/example', 'youtube'],
    ['https://www.instagram.com/reel/example/', 'instagram'],
  ])('识别 %s', (url, platform) => {
    expect(parseVideoImportUrl(url).platform).toBe(platform)
  })
  it('从抖音分享文字中提取链接，不包含尾随文字', () => {
    expect(parseVideoImportUrl('复制打开抖音 https://v.douyin.com/abc/ aNj:/ W@M.Wm 12/17 :5pm')).toEqual({
      url: 'https://v.douyin.com/abc/', platform: 'douyin',
    })
  })
  it('拒绝同时包含多个链接的分享文字', () => {
    expect(() => parseVideoImportUrl('https://v.douyin.com/a/ https://v.douyin.com/b/')).toThrow()
  })
  it.each(['http://douyin.com/video/1', 'https://douyin.com.example.org/', 'https://douyin.com@evil.example/', 'https://youtube.com:8443/watch?v=1', 'file:///video.mp4'])('拒绝不安全链接 %s', (url) => {
    expect(() => parseVideoImportUrl(url)).toThrow()
  })
})
