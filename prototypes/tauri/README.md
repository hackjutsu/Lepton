# Lepton Rust prototype

This prototype runs Lepton's existing React interface in Tauri, with Rust-backed
SQLite storage and session-only GitHub and GitLab connections. It is not yet a
complete replacement for the Electron application.

## Build

Install Node.js 24, Rust stable, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
The frontend build also uses dependencies from the repository root:

```sh
npm ci
cd prototypes/tauri
npm ci
npm run build
npm test
npm start
```

`npm run package` builds platform bundles on the host operating system. The
configuration supports macOS, Windows, and Linux; platform prerequisites and
build tooling are required. The automated cross-platform workflow has not yet
established that every target works in practice.

## Libraries and accounts

The local library supports multi-file create, read, edit, and delete in SQLite.
Data lives in Tauri's app data directory for `io.lepton.rust-prototype`
(normally `~/Library/Application Support/io.lepton.rust-prototype` on macOS).
Set `LEPTON_PROTOTYPE_DATA_DIR` before launching to use an isolated directory.
Previous local prototype data is imported once without modifying the source.
Snippets are stored as plaintext; files have a 2 MB limit. Concurrent edits to
the same local snippet are last-write-wins.

Connect an account using a GitHub or GitLab personal access token, optionally
with an enterprise or self-managed server URL. Tokens are held in memory for
the session and must be entered again after restarting. Account switching keeps
the local library separate. Remote content is not cached in the local database.
GitHub snippet files returned truncated by the API are rejected to avoid
accidentally overwriting incomplete content. Remote links open in the system
browser, and sharing copies a provider link. Some native integrations and
preferences still need implementation.

The prototype also contains an experimental GitHub OAuth flow. It requires an
OAuth app with callback `http://127.0.0.1/callback` and the environment variables
`LEPTON_GITHUB_OAUTH_CLIENT_ID` and `LEPTON_GITHUB_OAUTH_CLIENT_SECRET`. Live
OAuth verification is deferred. Neither OAuth credentials nor the provided
personal access token are needed for local library use.

Preferences currently use WebView local storage; existing Lepton settings are
not migrated. Copying uses the Tauri clipboard plugin. Failed saves leave the
draft in the editor. The original editor's unsaved-change behavior and other
platform integrations need broader verification before production use.

## Tests and verification

`npm test` runs Rust unit tests. From the repository root, `npm run test:unit`
runs the shared frontend tests. `npm run test:ui` in this directory builds a
test-only WebDriver-enabled app and exercises the native WebView with isolated
fixture data. It launches one window, removes its temporary database, and can
write a screenshot to `LEPTON_UI_SCREENSHOT`. Set `LEPTON_TEST_GITHUB_TOKEN` to
also test a live token connection and profile image (the token is never passed
to the app as an environment variable). WebDriver is excluded from normal
builds. The GitHub Actions workflow runs the UI checks on macOS, Windows, and
Linux; results on the latter two platforms are pending.

On Apple Silicon, the original Lepton layout and avatar rendered in the native
window, and fixture checks covered editors, filters, search, dashboard,
settings, rendered files, and confirmation dialogs. A disposable local GitLab
instance was used for a live Rust transport round trip and an interactive
create/edit test. A disposable private Gist was created, read, edited, and
deleted against GitHub with a personal access token. These checks do not prove
complete UI, platform, or feature parity. The native app also connected with a
GitHub token and loaded the account's profile image. The earlier clipboard-enabled macOS
prototype measured 8.06 MiB installed excluding the OS webview; this is not a
full-feature size comparison. RAM has not been measured across the process
family.
