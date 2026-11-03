import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parseDouyinSharePage } from './douyin-share'

const pageDomains = ['douyin.com', 'iesdouyin.com']
const mediaDomains = [...pageDomains, 'douyinvod.com', 'amemv.com', 'bytecdn.cn', 'byteimg.com', 'snssdk.com', 'bytedance.com', 'ixigua.com']
const headers = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', Referer: 'https://www.douyin.com/' }

export function validateDouyinUrl(value: string, domains: string[]): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !domains.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) {
    throw new Error('抖音返回了不受支持的地址，已停止导入')
  }
  return url.href
}

async function request(url: string, domains: string[], responseType: 'text' | 'stream') {
  for (let redirects = 0; redirects <= 4; redirects++) {
    const safeUrl = validateDouyinUrl(url, domains)
    const response = await axios.get(safeUrl, { headers, responseType, maxRedirects: 0, timeout: 30000, maxContentLength: 4 * 1024 * 1024, validateStatus: () => true })
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      if (responseType === 'stream') response.data.destroy()
      url = new URL(response.headers.location, safeUrl).href
      continue
    }
    if (response.status !== 200) {
      if (responseType === 'stream') response.data.destroy()
      throw new Error(`抖音公开页面暂时无法访问（HTTP ${response.status}），该链接可能需要平台验证，请稍后重试`)
    }
    return response
  }
  throw new Error('抖音链接跳转次数过多')
}

export function douyinVideoId(value: string): string | null {
  const url = new URL(validateDouyinUrl(value, pageDomains))
  return url.pathname.match(/^\/(?:share\/)?video\/(\d+)\/?$/)?.[1] ?? null
}

export async function downloadDouyinVideo(url: string, folder: string, progress: (value: string) => void): Promise<void> {
  let id = douyinVideoId(url)
  if (!id) {
    // Short links normally redirect to a canonical video URL; do not follow an unvalidated redirect.
    let current = url
    for (let i = 0; i < 4 && !id; i++) {
      const response = await axios.get(validateDouyinUrl(current, pageDomains), { headers, maxRedirects: 0, timeout: 15000, responseType: 'text', maxContentLength: 4 * 1024 * 1024, validateStatus: () => true })
      if (response.status < 300 || response.status >= 400 || !response.headers.location) break
      current = validateDouyinUrl(new URL(response.headers.location, current).href, pageDomains)
      id = douyinVideoId(current)
    }
  }
  if (!id) throw new Error('无法从抖音分享链接识别作品，请确认链接有效')
  let media: string | null = null
  try {
    const page = await request(`https://www.iesdouyin.com/share/video/${id}/`, pageDomains, 'text')
    media = parseDouyinSharePage(String(page.data), id)
  } catch { /* Fall back to the isolated browser. */ }
  if (!media) {
    const { findDouyinVideoInBrowser } = await import('./douyin-browser')
    media = await findDouyinVideoInBrowser(id)
  }
  if (!media) throw new Error('抖音没有返回该作品的公开视频地址，可能触发了平台验证；当前免登录方式暂不适用于此链接')
  const response = await request(media, mediaDomains, 'stream')
  const type = String(response.headers['content-type'] || '').toLowerCase()
  if (type && !type.startsWith('video/') && !type.startsWith('application/octet-stream')) {
    response.data.destroy()
    throw new Error('抖音返回的内容不是视频，可能需要平台验证')
  }
  const temporary = path.join(folder, `.douyin-${id}-${randomBytes(12).toString('hex')}.part`)
  const total = Number(response.headers['content-length']) || 0
  let received = 0
  let prefix = Buffer.alloc(0)
  const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    received += chunk.length
    if (prefix.length < 64) prefix = Buffer.concat([prefix, chunk]).subarray(0, 64)
    if (total) progress(Math.min(99, Math.floor(received * 100 / total)).toString())
    callback(null, chunk)
  } })
  let created = false
  try {
    const file = fs.createWriteStream(temporary, { flags: 'wx' })
    file.once('open', () => { created = true })
    await pipeline(response.data, meter, file)
    if (received < 12 || !prefix.includes(Buffer.from('ftyp'))) throw new Error('下载的内容不是有效的 MP4 视频')
    for (let index = 0; ; index++) {
      const destination = path.join(folder, `Douyin-${id}${index ? `-${index}` : ''}.mp4`)
      try { fs.linkSync(temporary, destination); break } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
    progress('100')
  } finally {
    if (created) fs.unlinkSync(temporary)
  }
}
