import { describe, expect, it } from 'vitest'

import {
  adaptedLanguage,
  highlightContent
} from '../../app/containers/codeArea/highlighting'

const cSource = '#include<stdio.h>\n\nint main(void) {\n    printf("Hello World\\n");\n    return 0;\n}'
const typedReturnPythonSource = [
  'class Solution:',
  '    def totalFruit(self, fruits: List[int]) -> int:',
  '        return len(fruits)'
].join('\n')

describe('CodeArea syntax highlighting', () => {
  it('normalizes GitHub language names for Highlight.js', () => {
    expect(adaptedLanguage('main.c', 'C')).toBe('c')
    expect(adaptedLanguage('main.cpp', 'C++')).toBe('cpp')
    expect(adaptedLanguage('Program.cs', 'C#')).toBe('cs')
    expect(adaptedLanguage('App.m', 'Objective-C')).toBe('objectivec')
    expect(adaptedLanguage('App.mm', 'Objective-C++')).toBe('objectivec')
    expect(adaptedLanguage('script.bat', 'Batchfile')).toBe('dos')
    expect(adaptedLanguage('App.vue', 'Vue')).toBe('xml')
    expect(adaptedLanguage('shell.sh', 'Shell')).toBe('bash')
    expect(adaptedLanguage('pSolution1.py', 'Python')).toBe('python')
    expect(adaptedLanguage('form.vb', 'Visual Basic')).toBe('vbscript')
  })

  it('falls back to C highlighting for C source and header file extensions', () => {
    expect(adaptedLanguage('main.c')).toBe('c')
    expect(adaptedLanguage('main.h')).toBe('c')
  })

  it('uses extension overrides for files without GitHub language metadata', () => {
    expect(adaptedLanguage('.leptonrc')).toBe('json')
    expect(adaptedLanguage('setup.CMD')).toBe('dos')
    expect(adaptedLanguage('.zshrc')).toBe('bash')
    expect(adaptedLanguage('pSolution1.py')).toBe('python')
    expect(adaptedLanguage('script.PYW')).toBe('python')
    expect(adaptedLanguage('query.SQL')).toBe('sql')
    expect(adaptedLanguage('Contract.sol')).toBe('solidity')
    expect(adaptedLanguage('Contract.solidity')).toBe('solidity')
    expect(adaptedLanguage('Component.VUE')).toBe('xml')
  })

  it('does not let ambiguous C header fallback override provided metadata', () => {
    expect(adaptedLanguage('types.h', 'C++')).toBe('cpp')
    expect(adaptedLanguage('ObjCBridge.h', 'Objective-C')).toBe('objectivec')
  })

  it('renders C source with Highlight.js spans instead of escaped plain text', () => {
    const html = highlightContent(cSource, adaptedLanguage('main.c', 'C'))

    expect(html).toContain('hljs-keyword')
    expect(html).toContain('hljs-string')
    expect(html).toContain('&lt;stdio.h&gt;')
  })

  it('renders Python functions with return annotations using Python highlighting', () => {
    const html = highlightContent(typedReturnPythonSource, adaptedLanguage('pSolution1.py'))

    expect(html).toContain('<span class="hljs-keyword">def</span>')
    expect(html).toContain('<span class="hljs-title function_">totalFruit</span>')
    expect(html).toContain('<span class="hljs-keyword">return</span>')
  })

  it('falls back to automatic highlighting for unknown language names', () => {
    const html = highlightContent('function answer() { return 42 }', 'Other')

    expect(html).toContain('hljs-keyword')
  })
})
