/** "he" when the text contains Hebrew letters, so screen readers use the right voice. */
export function langOf(text: string): 'he' | undefined {
  return /[֐-׿]/.test(text) ? 'he' : undefined
}

/** Plain text shown for the instant before Markdown is ready: no raw ``` or ** marks. */
export function stripMarkdown(md: string) {
  return md
    .split('\n')
    .filter((line) => !/^\s*(```|~~~)/.test(line))
    .join('\n')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\W)[*_](\S[^*_\n]*?)[*_](?=\W|$)/g, '$1$2')
}
