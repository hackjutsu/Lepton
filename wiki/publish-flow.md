# Publish Flow

Lepton publishes desktop builds through the `Release` GitHub Actions workflow.
Merging release-flow changes does not publish anything by itself. Publishing
starts only when a version tag is pushed or when the workflow is run manually.

## Release Types

| Flow | Tag example | GitHub release | Snap channel | Stable users notified |
| :--- | :--- | :--- | :--- | :--- |
| Stable release | `v1.10.2` | Published release | `stable` | Yes, when `autoUpdate` is enabled |
| Prerelease | `v1.11.0-beta.1` | Prerelease | `edge` | No |
| Manual dry run | No tag | No release by default | No store publish by default | No |

Stable tags must be plain semver tags:

```bash
git tag v1.10.2
git push origin v1.10.2
```

Prerelease tags must include a semver prerelease suffix:

```bash
git tag v1.11.0-alpha.1
git push origin v1.11.0-alpha.1

git tag v1.11.0-beta.1
git push origin v1.11.0-beta.1

git tag v1.11.0-rc.1
git push origin v1.11.0-rc.1
```

The workflow rejects tags that do not look like `v1.2.3` or
`v1.2.3-beta.1`.

## Required Secrets

Configure these in GitHub Actions secrets before publishing:

| Secret | Used by | Required for |
| :--- | :--- | :--- |
| `LEPTON_GITHUB_CLIENT_ID` | All packaging jobs | All release builds |
| `LEPTON_GITHUB_CLIENT_SECRET` | All packaging jobs | All release builds |
| `APPLE_ID` | macOS | Stable signed/notarized macOS release |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | Stable signed/notarized macOS release |
| `APPLE_TEAM_ID` | macOS | Stable signed/notarized macOS release |
| `CSC_LINK` | macOS | Stable signed/notarized macOS release |
| `CSC_KEY_PASSWORD` | macOS | Stable signed/notarized macOS release |
| `WINDOWS_CSC_LINK` | Windows | Signed Windows release |
| `WINDOWS_CSC_KEY_PASSWORD` | Windows | Signed Windows release |
| `SNAPCRAFT_STORE_CREDENTIALS` | Linux | Snap Store publish |

The workflow uses GitHub's built-in `GITHUB_TOKEN` for GitHub Release uploads.

`configs/account.js` is not committed. Each release job generates it from
`LEPTON_GITHUB_CLIENT_ID` and `LEPTON_GITHUB_CLIENT_SECRET` before packaging so
release artifacts use the configured GitHub OAuth app.

Use GitHub Environments if prerelease and production should have different
secret values or approval rules.

## Stable Release Flow

Use this flow for versions intended for all users.

```text
merge release-ready code to master
    |
    v
create plain semver tag, for example v1.10.2
    |
    v
push tag to origin
    |
    v
Release workflow
    |
    +--> resolve context:
    |       publish_policy=always
    |       github_release_type=release
    |       environment=production
    |       snap_channels=stable
    |
    +--> validate:
    |       npm run lint
    |       npm run test:unit
    |       npm run test:build
    |
    +--> build macOS:
    |       dmg + zip for x64
    |       dmg + zip for arm64
    |       signed and notarized when Apple secrets are present
    |
    +--> build Windows:
    |       NSIS installer for x64 and ia32
    |       7z archive for x64 and ia32
    |       signed when Windows certificate secrets are present
    |
    +--> build Linux:
    |       AppImage for x64
    |       snap for x64
    |
    v
publish GitHub Release and release assets
    |
    v
publish Snap to stable channel
    |
    v
stable auto-update metadata is available
```

The macOS job builds Intel and Apple Silicon artifacts in one electron-builder
run so `latest-mac.yml` is generated once for the full macOS artifact set.

Stable app builds are eligible to check for updates when the user's
`.leptonrc` has:

```json
{
  "autoUpdate": true
}
```

Only newer stable versions should notify users. Prerelease candidates are
ignored by the updater policy.

## Prerelease Flow

Use this flow for testing builds that should be public but should not notify
stable users.

```text
merge prerelease-ready code to master
    |
    v
create semver prerelease tag, for example v1.11.0-beta.1
    |
    v
push tag to origin
    |
    v
Release workflow
    |
    +--> resolve context:
    |       publish_policy=always
    |       github_release_type=prerelease
    |       environment=prerelease
    |       snap_channels=edge
    |
    +--> validate:
    |       npm run lint
    |       npm run test:unit
    |       npm run test:build
    |
    +--> build macOS, Windows, and Linux artifacts
    |
    v
publish GitHub prerelease and prerelease assets
    |
    v
publish Snap to edge channel
    |
    v
no stable-user auto-update notification
```

Prerelease app versions do not check for updates. Stable app versions also do
not notify for prerelease update candidates.

## Manual Release Workflow Runs

The workflow can be started manually from the GitHub Actions UI.

Manual inputs:

| Input | Default | Purpose |
| :--- | :--- | :--- |
| `publish` | `never` | Use `never` for a packaging dry run. Use `always` to publish. |
| `release_type` | `draft` | GitHub release type for manual publishing: `draft`, `prerelease`, or `release`. |
| `snap_channels` | `edge` | Comma-separated Snap channels for manual publishing. |

Manual runs default to `publish=never`, so they build artifacts and upload
workflow artifacts without creating a GitHub Release or publishing to the Snap
Store.

## Expected Artifacts

Artifact names include product name, version, operating system, architecture,
and extension:

```text
Lepton-1.10.2-mac-x64.dmg
Lepton-1.10.2-mac-arm64.zip
Lepton-1.10.2-win-x64.exe
Lepton-1.10.2-win-ia32.7z
Lepton-1.10.2-linux-x64.AppImage
Lepton-1.10.2-linux-x64.snap
```

Updater metadata files such as `latest.yml` and `latest-mac.yml` are also
generated and published with GitHub release assets.

## Failure Handling

If validation fails, fix the branch and create a new tag after the fix is
merged. Do not reuse a published version tag unless the failed workflow did not
publish any artifacts.

If publishing partially succeeds:

1. Remove or repair the incomplete GitHub Release assets.
2. Remove incorrect Snap channel revisions or close the affected channel in the
   Snap Store.
3. Create a new patch or prerelease tag.
4. Run the release flow again from the new tag.

Avoid force-moving public release tags after users may have downloaded assets.

## Local Packaging Fallback

Local packaging is still available for diagnosing build issues:

```bash
npm ci
npm run dist -- -m
npm run dist -- -w
npm run dist -- -l
```

Local release-like packaging still needs `configs/account.js` to exist. The
GitHub Actions workflow generates this file from secrets; local builds must
create it manually.

