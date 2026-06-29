import { describe, expect, it } from 'vitest'

import {
  adaptedLanguage,
  highlightContent
} from '../../app/containers/codeArea/highlighting'

const cSource = '#include<stdio.h>\n\nint main(void) {\n    printf("Hello World\\n");\n    return 0;\n}'

describe('CodeArea syntax highlighting', () => {
  it('normalizes GitHub C and C++ language names for Highlight.js', () => {
    expect(adaptedLanguage('main.c', 'C')).toBe('c')
    expect(adaptedLanguage('main.cpp', 'C++')).toBe('cpp')
  })

  it('falls back to C highlighting for C source and header file extensions', () => {
    expect(adaptedLanguage('main.c')).toBe('c')
    expect(adaptedLanguage('main.h')).toBe('c')
  })

  it('renders C source with Highlight.js spans instead of escaped plain text', () => {
    const html = highlightContent(cSource, adaptedLanguage('main.c', 'C'))

    expect(html).toContain('hljs-keyword')
    expect(html).toContain('hljs-string')
    expect(html).toContain('&lt;stdio.h&gt;')
  })
})
