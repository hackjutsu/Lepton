import { addLangPrefix as Prefixed } from '../../utilities/parser'

export function getNextActiveGistTag (clickedTag, activeGistTag) {
  if (clickedTag === activeGistTag) {
    return Prefixed('All')
  }

  return clickedTag
}
