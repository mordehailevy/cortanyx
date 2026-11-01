import { describe, expect, it } from 'vitest'
import { stripMarkdown } from './text'

describe('stripMarkdown', () => {
  it('removes fences and marks but keeps the code and the words', () => {
    const md = '## Title\n\nSome **bold**, _italic_ and `code`.\n\n```python\nprint(a * b)\n```'
    expect(stripMarkdown(md)).toBe('Title\n\nSome bold, italic and code.\n\nprint(a * b)')
  })
  it('leaves snake_case and plain text alone', () => {
    expect(stripMarkdown('use my_var_name here')).toBe('use my_var_name here')
  })
})
