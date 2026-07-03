import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const formSource = readFileSync(
  new URL('../../app/containers/gistEditorForm/index.js', import.meta.url),
  'utf8'
)
const formStyles = readFileSync(
  new URL('../../app/containers/gistEditorForm/index.scss', import.meta.url),
  'utf8'
)

function getTipsButtonSource () {
  const match = formSource.match(/<button\s+className='tips'[\s\S]+?<\/button>/)
  return match ? match[0] : ''
}

function getPrivacyCheckboxSource () {
  const match = formSource.match(/<label\s+className='gist-editor-privacy-checkbox'[\s\S]+?<\/label>/)
  return match ? match[0] : ''
}

describe('gist editor form controls', () => {
  it('renders tips as a non-submit button with inline tooltip content', () => {
    const tipsButtonSource = getTipsButtonSource()

    expect(formSource).toContain("const DESCRIPTION_TIPS_ID = 'gist-editor-description-tips'")
    expect(formSource).toContain('const descriptionTips = getDescriptionTips()')
    expect(formSource).toContain('placeholder={ descriptionTips }')
    expect(tipsButtonSource).toContain("type='button'")
    expect(tipsButtonSource).toContain('aria-label={ `${tipsLabel}: ${descriptionTips}` }')
    expect(tipsButtonSource).toContain('aria-describedby={ DESCRIPTION_TIPS_ID }')
    expect(tipsButtonSource).toContain("className='tips-popover'")
    expect(tipsButtonSource).toContain('id={ DESCRIPTION_TIPS_ID }')
    expect(tipsButtonSource).toContain("role='tooltip'")
    expect(tipsButtonSource).not.toContain('href=')
    expect(tipsButtonSource).not.toContain('onClick=')
  })

  it('shows the inline tooltip on hover and focus', () => {
    expect(formStyles).toContain('&:hover .tips-popover')
    expect(formStyles).toContain('&:focus .tips-popover')
    expect(formStyles).toMatch(/opacity:\s*1;/)
    expect(formStyles).toMatch(/visibility:\s*visible;/)
  })

  it('keeps the secret checkbox and label text aligned', () => {
    const privacyCheckboxSource = getPrivacyCheckboxSource()

    expect(privacyCheckboxSource).toContain("className='gist-editor-privacy-input'")
    expect(privacyCheckboxSource).toContain("<span>{ t('editor.secret') }</span>")
    expect(privacyCheckboxSource).not.toContain('&nbsp;')
    expect(formStyles).toMatch(/\.gist-editor-privacy-checkbox\s*\{[\s\S]+align-items:\s*center;/)
    expect(formStyles).toMatch(/\.gist-editor-privacy-checkbox\s*\{[\s\S]+display:\s*inline-flex;/)
    expect(formStyles).toMatch(/\.gist-editor-privacy-checkbox\s*\{[\s\S]+gap:\s*6px;/)
    expect(formStyles).toMatch(/\.gist-editor-privacy-input\s*\{[\s\S]+margin:\s*0px;/)
  })
})
