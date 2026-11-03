/** 将口播文案按自然停顿拆分，保留原文标点和顺序。 */
export function splitScriptSentences(script: string): string[] {
  return script
    .split(/(?<=[。！？!?；;])|\r?\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}
