import { BrowserWindow, session } from 'electron'
import { randomBytes } from 'node:crypto'
import { isDouyinMediaForVideo } from './douyin-share'

/** 在临时匿名会话中读取当前作品正在播放的地址。 */
export async function findDouyinVideoInBrowser(id: string): Promise<string | null> {
  if (!/^\d+$/.test(id)) return null
  const isolated = session.fromPartition(`douyin-import-${randomBytes(12).toString('hex')}`)
  isolated.setPermissionCheckHandler(() => false)
  isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  const win = new BrowserWindow({ show: false, webPreferences: { session: isolated, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } })
  win.webContents.setAudioMuted(true)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const restrictNavigation = (event: Electron.Event, target: string) => {
    try {
      const url = new URL(target)
      if (url.protocol === 'https:' && (url.hostname === 'douyin.com' || url.hostname.endsWith('.douyin.com'))) return
    } catch { /* Reject malformed destinations. */ }
    event.preventDefault()
  }
  win.webContents.on('will-navigate', restrictNavigation)
  win.webContents.on('will-redirect', restrictNavigation)
  return new Promise((resolve) => {
    let finished = false
    let busy = false
    const finish = (value: string | null) => {
      if (finished) return
      finished = true
      clearInterval(interval)
      clearTimeout(timeout)
      if (!win.isDestroyed()) win.destroy()
      resolve(value)
    }
    const interval = setInterval(async () => {
      if (busy || finished || win.isDestroyed()) return
      busy = true
      try {
        const result = await win.webContents.executeJavaScript(`(() => {
          if (location.hostname !== 'www.douyin.com' || location.pathname !== '/video/${id}') return null;
          const videos = [...document.querySelectorAll('video')].filter(v => v.currentSrc.startsWith('https:') && v.readyState >= 2);
          return videos.length === 1 ? videos[0].currentSrc : null;
        })()`)
        if (typeof result === 'string' && isDouyinMediaForVideo(result, id)) finish(result)
      } catch { /* Navigation may still be in progress. */ }
      finally { busy = false }
    }, 1000)
    const timeout = setTimeout(() => finish(null), 25000)
    win.loadURL(`https://www.douyin.com/video/${id}`).catch(() => finish(null))
  })
}
