import { describe, expect, it } from 'vitest'
import { isDouyinMediaForVideo, parseDouyinSharePage } from '../../electron/lib/douyin-share'

describe('抖音分享页解析', () => {
  it('浏览器播放地址必须明确匹配目标作品，拒绝推荐视频和未知来源', () => {
    expect(isDouyinMediaForVideo('https://v.douyinvod.com/video?__vid=123', '123')).toBe(true)
    expect(isDouyinMediaForVideo('https://v.douyinvod.com/video?__vid=456', '123')).toBe(false)
    expect(isDouyinMediaForVideo('https://v.douyinvod.com/video', '123')).toBe(false)
    expect(isDouyinMediaForVideo('https://v.douyinvod.com/video?__vid=123&__vid=456', '123')).toBe(false)
  })
  it('只返回匹配作品的 HTTPS 视频地址', () => {
    const data = { items: [{ aweme_id: '123', video: { play_addr: { url_list: ['https://media.example/video'] } } }, { aweme_id: '456', video: { play_addr: { url_list: ['https://other.example/video'] } } }] }
    const html = `<script>window._ROUTER_DATA = ${JSON.stringify(data)};</script>`
    expect(parseDouyinSharePage(html, '123')).toBe('https://media.example/video')
    expect(parseDouyinSharePage(html, '999')).toBeNull()
  })
  it('拒绝验证码页、不完整 JSON 和非 HTTPS 地址', () => {
    expect(parseDouyinSharePage('<html>验证</html>', '123')).toBeNull()
    expect(parseDouyinSharePage('<script>window._ROUTER_DATA = {broken};</script>', '123')).toBeNull()
    expect(parseDouyinSharePage('<script>window._ROUTER_DATA = {"aweme_id":"123","video":{"play_addr":{"url_list":["http://local/"]}}};</script>', '123')).toBeNull()
  })
})
