import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloneMiniMaxVoice } from '../../electron/tts/minimax'
import fs from 'node:fs'
import { parseFile } from 'music-metadata'

vi.mock('music-metadata', () => ({ parseFile: vi.fn() }))

describe('MiniMax voice cloning', () => {
  const originalAdapter = axios.defaults.adapter
  afterEach(() => { axios.defaults.adapter = originalAdapter })

  it.each([
    ['integer', '1234567890123456789'],
    ['string', '"1234567890123456789"'],
  ])('preserves a long %s file ID when sending the clone request', async (_kind, id) => {
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({ isFile: () => true, size: 100 } as any)
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('test audio'))
    vi.mocked(parseFile).mockResolvedValue({ format: { duration: 12 } } as any)
    const requests: Array<{ url?: string; data: unknown }> = []
    axios.defaults.adapter = async config => {
      requests.push({ url: config.url, data: config.data })
      return {
        data: config.url?.endsWith('/files/upload')
          ? `{"file":{"file_id":${id}},"base_resp":{"status_code":0}}`
          : '{"base_resp":{"status_code":0}}',
        status: 200, statusText: 'OK', headers: {}, config,
      }
    }

    await cloneMiniMaxVoice({ apiKey: 'test-key', apiRegion: 'china', samplePath: 'test.wav', previewText: 'hello' })
    expect(requests).toHaveLength(2)
    expect(requests[1].url).toContain('/voice_clone')
    expect(requests[1].data).toContain('"file_id":1234567890123456789,')
  })

  it('reports a MiniMax upload error without requesting a clone', async () => {
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({ isFile: () => true, size: 100 } as any)
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('test audio'))
    vi.mocked(parseFile).mockResolvedValue({ format: { duration: 12 } } as any)
    const adapter = vi.fn(async config => ({
      data: '{"base_resp":{"status_code":1004,"status_msg":"invalid key"}}',
      status: 200, statusText: 'OK', headers: {}, config,
    }))
    axios.defaults.adapter = adapter
    await expect(cloneMiniMaxVoice({ apiKey: 'test-key', apiRegion: 'china', samplePath: 'test.wav', previewText: 'hello' }))
      .rejects.toThrow('voice sample upload failed (1004): invalid key')
    expect(adapter).toHaveBeenCalledTimes(1)
  })
})
