import { describe, expect, it } from 'vitest'
import { splitScriptSentences } from '../../src/lib/agent/script-sentences'

describe('splitScriptSentences', () => {
  it('保留标点，按中英文句末和换行拆分', () => {
    expect(splitScriptSentences('免打孔安装！风力强劲。\nTry it! Easy to use.')).toEqual([
      '免打孔安装！',
      '风力强劲。',
      'Try it!',
      'Easy to use.',
    ])
  })

  it('忽略空白，不拆小数和逗号', () => {
    expect(splitScriptSentences('  \n型号 2.5，安装简单；\n ')).toEqual(['型号 2.5，安装简单；'])
  })
})
