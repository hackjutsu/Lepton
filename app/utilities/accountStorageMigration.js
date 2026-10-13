import { normalizeProviderConfig } from './snippetProvider'

const LEGACY_ACCOUNT_MIGRATION_PREFIX = 'legacy-account-storage-migration'

function hasStoredValue (result) {
  return Boolean(result && result.status && result.data !== null && result.data !== undefined)
}

export function migrateLegacyGitHubAccountStorage ({
  provider,
  login,
  accountKey,
  localPref,
  localStorage
}) {
  const normalizedProvider = normalizeProviderConfig(provider)
  if (normalizedProvider.type !== 'github' || !login || !accountKey || login === accountKey) {
    return
  }

  const migrationLogin = String(login).trim().toLowerCase()
  const migrationKey = `${LEGACY_ACCOUNT_MIGRATION_PREFIX}-${encodeURIComponent(migrationLogin)}`
  try {
    if (hasStoredValue(localStorage.get(migrationKey))) return
  } catch {
    return
  }

  let hasLegacyPreferences = false

  try {
    const legacyPreferences = localPref.get(login)
    if (legacyPreferences !== undefined && legacyPreferences !== null) {
      hasLegacyPreferences = true
      if (localPref.get(accountKey) === undefined) {
        localPref.set(accountKey, legacyPreferences)
      }
    }
  } catch {
    // Migration is best-effort and must not prevent sign-in.
  }

  // Legacy drafts have no provider provenance and may contain private source.
  // Leave them untouched rather than exposing one to a same-named account on
  // another GitHub host.
  if (hasLegacyPreferences) {
    try {
      localStorage.set(migrationKey, accountKey)
    } catch {
      // Migration is best-effort and must not prevent sign-in.
    }
  }
}
