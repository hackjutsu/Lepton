# Lepton Rust prototype

This prototype runs Lepton's existing React interface in Tauri, with Rust-backed
SQLite storage and GitHub and GitLab connections. It is not yet a
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

Use the existing Logout control in the local library to open Lepton's login
screen, then select GitHub or GitLab and enter a personal access token. For
GitHub, the login screen's key icon switches to token login. Enterprise and
self-managed server settings are available through the existing configuration.
Provider credentials follow `security.cachedAccessTokenStorage`: `file` stores
the token in a local file, `encrypted` uses the operating system credential
store, and `auto` uses file storage for development builds and secure storage
for packaged builds. Like Electron, the encrypted mode falls back to a local
file when secure storage is unavailable and logs a warning. Logging out removes
the saved credential and returns to the login screen; restart to open the local
library. The last synced remote library is cached in SQLite so downloaded
snippets can be opened offline; the cached snippets are
plaintext just like the local library. These new behaviors still need native
end-to-end verification on each supported platform.

For a one-time GitHub sign-in at startup, set `LEPTON_GITHUB_TOKEN_FILE` to a
local file containing the token. The file is read once; after successful sign-in
the token is saved according to the configured credential storage mode. The
startup option always connects to github.com.
GitHub files truncated by the API are fetched from a trusted raw URL with size
and completeness checks. Snippets whose entire file list is truncated and files
larger than 10 MiB remain unavailable for safe editing. Remote links open in the system
browser, and sharing copies a provider link. Some native integrations and
preferences still need implementation.

The prototype also contains an experimental GitHub OAuth flow. It requires an
OAuth app with callback `http://127.0.0.1/callback` and the environment variables
`LEPTON_GITHUB_OAUTH_CLIENT_ID` and `LEPTON_GITHUB_OAUTH_CLIENT_SECRET`. Live
OAuth verification is deferred. Neither OAuth credentials nor the provided
personal access token are needed for local library use.

The `autoUpdate` preference is not yet functional in the Rust prototype. It
requires a signed Tauri release feed and public verification key; those have
not been set up yet.

Preferences read and write `.leptonrc` in the user's home directory. Isolated
UI tests use their temporary data directory instead. Settings absent from the
file use Lepton's defaults. The prototype writes a
separate log in its app-data directory and redacts known credential patterns
and the active provider token from renderer messages. Copying uses the Tauri
clipboard plugin. Failed saves leave the draft in the editor. The original
editor's unsaved-change behavior and other platform integrations need broader
verification before production use.

Use Command-Plus/Minus on macOS or Control-Plus/Minus on Windows and Linux to
change the current window zoom. Command/Control-0 resets it to 100%. These
shortcuts do not change the saved default zoom preference.

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
The UI suite also uses a disposable local provider to verify invalid-token
feedback, a saved edit, a Markdown task toggle, and cached offline startup.
See [the parity audit](docs/parity-audit.md) for remaining gaps.

On Apple Silicon, the original Lepton layout and avatar rendered in the native
window, and fixture checks covered editors, filters, search, dashboard,
settings, rendered files, and confirmation dialogs. A disposable local GitLab
instance was used for a live Rust transport round trip and an interactive
create/edit test. A disposable private Gist was created, read, edited, and
deleted against GitHub with a personal access token. These checks do not prove
complete UI, platform, or feature parity. The native app also connected with a
GitHub token and loaded the account's profile image. The earlier clipboard-enabled macOS
prototype measured 8.06 MiB installed excluding the OS webview; this is not a
full-feature size comparison. See [the benchmark notes](docs/benchmark.md)
for later bundle, process RSS, and latency measurements and their limitations.
