/** "he" when the text contains Hebrew letters, so screen readers use the right voice. */
export function langOf(text: string): 'he' | undefined {
  return /[֐-׿]/.test(text) ? 'he' : undefined
}
