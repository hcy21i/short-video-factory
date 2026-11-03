import { describe, expect, it } from 'vitest'
import { parseAnalysis } from '../../src/lib/agent/material-analysis'

describe('material frame analysis', () => {
  it('only accepts supplied sample ids and uses their actual timestamps', () => {
    const result = parseAnalysis(
      JSON.stringify({
        summary: 'product',
        materials: [
          {
            id: 'M01',
            samples: [
              { id: 'M01-F1', timeSeconds: 999, description: '安装画面' },
              { id: 'unknown', description: '虚构画面' },
            ],
          },
        ],
      }),
      [
        {
          id: 'M01',
          name: 'clip.mp4',
          samples: [{ id: 'M01-F1', timeSeconds: 2, image: new Uint8Array() }],
        },
      ],
    )
    expect(result.scenes[0].samples).toEqual([{ timeSeconds: 2, description: '安装画面' }])
  })
})
