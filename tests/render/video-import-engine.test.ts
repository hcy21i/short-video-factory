import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), app: { isPackaged: true } }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('electron', () => ({ app: mocks.app }))
vi.mock('../../electron/lib/douyin-import', () => ({ downloadDouyinVideo: vi.fn() }))
import { downloadVideo } from '../../electron/lib/video-import'

describe('packaged video importer', () => {
  it('starts the bundled engine without browser cookies or shell execution', async () => {
    const original = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
    Object.defineProperty(process, 'resourcesPath', { configurable: true, value: path.resolve('packaged-resources') })
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() })
    mocks.spawn.mockImplementationOnce(() => {
      queueMicrotask(() => child.emit('close', 0))
      return child
    })
    try {
      await downloadVideo('https://www.tiktok.com/@user/video/123', os.tmpdir(), () => {})
      const [command, args, options] = mocks.spawn.mock.calls[0]
      expect(command).toBe(path.join(process.resourcesPath, 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'))
      expect(args).toContain('--no-cookies')
      expect(args).toContain('--no-cookies-from-browser')
      expect(options).toMatchObject({ shell: false })
    } finally {
      if (original) Object.defineProperty(process, 'resourcesPath', original)
      else Reflect.deleteProperty(process, 'resourcesPath')
      mocks.spawn.mockReset()
    }
  })
})
