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

  it('opens local page find from the standard keyboard shortcut', async () => {
    const { buildMainMenuTemplate } = await import('../../app/utilities/menu/mainMenu')
    const template = buildMainMenuTemplate(key => `tx:${key}`)
    const editMenu = template.find(item => item.label === 'tx:menu.edit')
    const findItem = editMenu.submenu.find(item => item.label === 'tx:menu.findInPage')
    const send = vi.fn()

    expect(findItem.accelerator).toBe('CmdOrCtrl+F')

    findItem.click(null, { webContents: { send } })

    expect(send).toHaveBeenCalledWith('lepton:window:open-find-in-page')
  })
})
