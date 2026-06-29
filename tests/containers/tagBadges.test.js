import { describe, expect, it } from 'vitest'

import {
  getRegularTagsForGist,
  getTagBadgeClassName,
  getTagBadgeLabel,
  shouldUseColoredTags,
  getTagColorClass
} from '../../app/containers/tagBadges/tags'

describe('tag badge helpers', () => {
  it('combines description tags with matching regular gist tags', () => {
    const gistTags = {
      'lang@Shell': ['gist-1'],
      SSH: ['gist-1'],
      git: ['gist-1'],
      k8s: ['gist-1'],
      tmux: ['gist-1'],
      zsh: ['gist-2']
    }

    expect(getRegularTagsForGist('gist-1', '#tags: tmux, ssh, Git', gistTags)).toEqual([
      'tmux',
      'ssh',
      'Git',
      'k8s'
    ])
  })

  it('excludes language tags and non-matching gist tags', () => {
    const gistTags = {
      'lang@Markdown': ['gist-1'],
      docs: ['gist-2'],
      lepton: ['gist-1']
    }

    expect(getRegularTagsForGist('gist-1', '', gistTags)).toEqual(['lepton'])
  })

  it('handles missing or malformed tag indexes', () => {
    const gistTags = {
      lepton: null,
      tmux: 'gist-1'
    }

    expect(getRegularTagsForGist('gist-1', undefined, gistTags)).toEqual([])
    expect(getRegularTagsForGist('gist-1', '#tags: tmux', undefined)).toEqual(['tmux'])
  })

  it('returns stable badge color classes', () => {
    expect(getTagColorClass('tmux')).toBe(getTagColorClass('tmux'))
    expect(getTagColorClass('tmux')).toMatch(/^tag-badge-color-[0-5]$/)
  })

  it('uses colored badge classes unless color rendering is disabled', () => {
    expect(shouldUseColoredTags(undefined)).toBe(true)
    expect(shouldUseColoredTags(true)).toBe(true)
    expect(shouldUseColoredTags(false)).toBe(false)

    expect(getTagBadgeClassName('tmux')).toMatch(/^tag-badge tag-badge-color-[0-5]$/)
    expect(getTagBadgeClassName('tmux', false)).toBe('tag-badge tag-badge-plain')
    expect(getTagBadgeLabel('tmux')).toBe('tmux')
    expect(getTagBadgeLabel('tmux', false)).toBe('#tmux')
  })
})
