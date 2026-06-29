import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  default: {
    app: {
      getName: () => 'Lepton'
    }
  },
  app: {
    getName: () => 'Lepton'
  }
}))

describe('main menu template', () => {
  it('uses the provided translator for labels', async () => {
    const { buildMainMenuTemplate } = await import('../../app/utilities/menu/mainMenu')
    const template = buildMainMenuTemplate(key => `tx:${key}`)

    expect(template.some(item => item.label === 'tx:menu.edit')).toBe(true)
    expect(template.some(item => item.label === 'tx:menu.view')).toBe(true)
    expect(template.some(item =>
      item.submenu && item.submenu.some(submenuItem => submenuItem.label === 'tx:menu.learnMore')
    )).toBe(true)
  })
})
