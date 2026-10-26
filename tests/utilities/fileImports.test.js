import { describe, expect, it } from 'vitest'
import { createFileAttachment, MAX_TEXT_FILE_SIZE_KB } from '../../app/utilities/fileImports'
import { getFilesFromTransfer } from '../../app/utilities/imageAttachments'

const file = (name, content, type = '') => new File([content], name, { type })

describe('file imports', () => {
  it.each(['hello.js', 'example.py', 'README.md', '.gitignore', 'Dockerfile'])(
    'preserves UTF-8 content and filename: %s', async filename => {
      const content = '# café 🚀\r\n\treturn 42\r\n'
      expect(await createFileAttachment(file(filename, content), 512)).toEqual({ filename, content })
    }
  )

  it('imports empty files for editing and strips a UTF-8 BOM', async () => {
    expect((await createFileAttachment(file('empty.txt', ''), 512)).content).toBe('')
    expect((await createFileAttachment(file('bom.txt', '\uFEFFhello'), 512)).content).toBe('hello')
  })

  it.each([new Uint8Array([0, 1, 2]), new Uint8Array([0xff, 0xfe, 65, 0])])(
    'rejects binary and non-UTF-8 files instead of corrupting their contents', async bytes => {
      await expect(createFileAttachment(file('data.bin', bytes), 512)).rejects.toMatchObject({ code: 'unsupported-file' })
    }
  )

  it('enforces the text limit independently of image preferences', async () => {
    expect((await createFileAttachment(file('code.txt', 'x'.repeat(65 * 1024)), 64)).content.length).toBe(65 * 1024)
    await expect(createFileAttachment(file('large.txt', 'x'.repeat(MAX_TEXT_FILE_SIZE_KB * 1024 + 1)), 512))
      .rejects.toMatchObject({ code: 'too-large', details: { maxSizeKB: MAX_TEXT_FILE_SIZE_KB } })
  })

  it('continues validating image signatures and converting images to Base64', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    expect(await createFileAttachment(file('logo.png', bytes, 'image/png'), 512))
      .toMatchObject({ filename: 'logo.png', content: 'iVBORw0KGgo=', _imageAttachment: true })
    await expect(createFileAttachment(file('fake.png', 'not an image'), 512))
      .rejects.toMatchObject({ code: 'unsupported-type' })
  })

  it('reads mixed drops while keeping clipboard text out of image paste handling', () => {
    const files = [file('code.js', 'hello'), file('logo.png', 'image', 'image/png')]
    expect(getFilesFromTransfer({ files }, false)).toEqual(files)
    expect(getFilesFromTransfer({ files })).toEqual([files[1]])
    expect(getFilesFromTransfer({ items: files.map(value => ({ kind: 'file', getAsFile: () => value })) }, false)).toEqual(files)
  })
})
