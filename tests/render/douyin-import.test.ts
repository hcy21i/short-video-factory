import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import axios from 'axios'
import { downloadDouyinVideo, douyinVideoId, validateDouyinUrl } from '../../electron/lib/douyin-import'
import { findDouyinVideoInBrowser } from '../../electron/lib/douyin-browser'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../../electron/lib/douyin-browser', () => ({ findDouyinVideoInBrowser: vi.fn().mockResolvedValue(null) }))
const get = vi.mocked(axios.get)
const folders: string[] = []
function folder() { const value = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-test-')); folders.push(value); return value }
const page = (id: string) => `<script>window._ROUTER_DATA = ${JSON.stringify({ aweme_id: id, video: { play_addr: { url_list: ['https://v3.douyinvod.com/video'] } } })};</script>`
afterEach(() => { vi.resetAllMocks(); for (const value of folders.splice(0)) fs.rmSync(value, { recursive: true, force: true }) })

describe('抖音免登录导入', () => {
  it('识别视频 ID，并拒绝非抖音跳转地址', () => {
    expect(douyinVideoId('https://www.douyin.com/video/123')).toBe('123')
    expect(douyinVideoId('https://www.douyin.com/video/123abc')).toBeNull()
    expect(douyinVideoId('https://www.douyin.com/foo/video/123/other')).toBeNull()
    expect(() => validateDouyinUrl('https://douyin.com.evil.test/', ['douyin.com'])).toThrow()
    expect(() => validateDouyinUrl('https://127.0.0.1/', ['douyin.com'])).toThrow()
  })
  it('从短链接识别指定作品，下载有效视频且不覆盖原文件', async () => {
    const dir = folder()
    fs.writeFileSync(path.join(dir, 'Douyin-123.mp4'), 'existing')
    get.mockResolvedValueOnce({ status: 302, headers: { location: 'https://www.douyin.com/video/123' } })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: page('123') })
      .mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'video/mp4' }, data: Readable.from([Buffer.from('0000ftypisom00000000')]) })
    await downloadDouyinVideo('https://v.douyin.com/abc/', dir, () => {})
    expect(fs.readFileSync(path.join(dir, 'Douyin-123.mp4'), 'utf8')).toBe('existing')
    expect(fs.existsSync(path.join(dir, 'Douyin-123-1.mp4'))).toBe(true)
    expect(fs.readdirSync(dir)).toHaveLength(2)
  })
  it('页面被拦截或文件无效时不留下素材', async () => {
    const dir = folder()
    get.mockResolvedValueOnce({ status: 200, headers: {}, data: '<html>verification</html>' })
    await expect(downloadDouyinVideo('https://www.douyin.com/video/123', dir, () => {})).rejects.toThrow('平台验证')
    get.mockResolvedValueOnce({ status: 200, headers: {}, data: page('123') })
      .mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'video/mp4' }, data: Readable.from(['not a video']) })
    await expect(downloadDouyinVideo('https://www.douyin.com/video/123', dir, () => {})).rejects.toThrow('有效的 MP4')
    expect(fs.readdirSync(dir)).toEqual([])
  })
  it('公开分享页没有视频时，使用匿名浏览器获取当前作品并下载', async () => {
    const dir = folder()
    get.mockResolvedValueOnce({ status: 200, headers: {}, data: '<html>无视频数据</html>' })
      .mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'video/mp4' }, data: Readable.from([Buffer.from('0000ftypisom00000000')]) })
    vi.mocked(findDouyinVideoInBrowser).mockResolvedValueOnce('https://v3.douyinvod.com/video')
    await downloadDouyinVideo('https://www.douyin.com/video/123', dir, () => {})
    expect(findDouyinVideoInBrowser).toHaveBeenCalledWith('123')
    expect(fs.readdirSync(dir)).toEqual(['Douyin-123.mp4'])
  })
  it('拒绝跳转到非抖音域名', async () => {
    get.mockResolvedValueOnce({ status: 302, headers: { location: 'https://evil.test/video/123' } })
    await expect(downloadDouyinVideo('https://v.douyin.com/abc/', folder(), () => {})).rejects.toThrow('不受支持')
    expect(get).toHaveBeenCalledTimes(1)
  })
})
