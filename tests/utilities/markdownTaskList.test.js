import { describe, expect, it } from 'vitest'

import { toggleMarkdownTaskListItem } from '../../app/utilities/markdown/taskList'

describe('Markdown task list utilities', () => {
  it('checks and unchecks a task by rendered checkbox order', () => {
    const source = [
      '- [ ] first',
      '- [x] second',
      '  - [ ] nested'
    ].join('\n')

    expect(toggleMarkdownTaskListItem(source, 0, true)).toBe([
      '- [x] first',
      '- [x] second',
      '  - [ ] nested'
    ].join('\n'))

    expect(toggleMarkdownTaskListItem(source, 1, false)).toBe([
      '- [ ] first',
      '- [ ] second',
      '  - [ ] nested'
    ].join('\n'))
  })

  it('supports ordered task list items', () => {
    const source = [
      '1. [ ] one',
      '2. [X] two'
    ].join('\n')

    expect(toggleMarkdownTaskListItem(source, 1, false)).toBe([
      '1. [ ] one',
      '2. [ ] two'
    ].join('\n'))
  })

  it('preserves source line endings', () => {
    const source = '- [ ] first\r\n- [ ] second\r\n'

    expect(toggleMarkdownTaskListItem(source, 1, true)).toBe('- [ ] first\r\n- [x] second\r\n')
  })

  it('leaves content unchanged when the task index is missing', () => {
    const source = '- [ ] first'

    expect(toggleMarkdownTaskListItem(source, 2, true)).toBe(source)
    expect(toggleMarkdownTaskListItem(source, -1, true)).toBe(source)
  })
})
