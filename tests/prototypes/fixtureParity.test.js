import { describe, expect, it } from 'vitest'
import { getRenderFixture } from '../../app/renderFixtures'
import rustFixtures from '../../prototypes/tauri/tests/ui/fixtures.json'

describe('Rust UI test fixtures', () => {
  it('use the same snippet data as the Electron active fixture', () => {
    const electronFixtures = Object.values(getRenderFixture('active').state.gists).map(gist => gist.details)
    expect(rustFixtures).toEqual(electronFixtures)
  })
})
