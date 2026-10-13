import { UPDATE_GIST_FILTERS, LOGOUT_USER_SESSION } from '../actions'
import { createDefaultGistFilters, normalizeGistFilters } from '../utilities/gistFilters'

export default function (state = createDefaultGistFilters(), action) {
  switch (action.type) {
    case UPDATE_GIST_FILTERS:
      return normalizeGistFilters(action.payload)
    case LOGOUT_USER_SESSION:
      return createDefaultGistFilters()
    default:
  }

  return state
}
