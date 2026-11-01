# Lepton local Rust prototype

This experiment runs Lepton's existing React components in Tauri with a local
SQLite store. It is **not a complete Lepton replacement**. GitHub and GitLab
connections are deliberately deferred, and online sharing, history, account and
sync actions are unavailable. Several native integrations and preferences still
need implementation and verification.

## Build

Install Node.js 24, Rust stable, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
The frontend build reuses dependencies from the repository root:

```sh
npm ci
cd prototypes/tauri
npm ci
npm run build
npm test
npm start
```

`npm start` builds the original React interface and runs a Tauri development
window. `npm run package` builds an optimized macOS `.app` under
`src-tauri/target/release/bundle/macos/`. The initial bundle target is macOS;
other platforms need their own native build prerequisites and Tauri targets.

## Local data

SQLite lives in Tauri's app data directory for `io.lepton.rust-prototype`
(normally `~/Library/Application Support/io.lepton.rust-prototype` on macOS).
Set `LEPTON_PROTOTYPE_DATA_DIR` before launching to use an isolated directory.
The previous JSON prototype is imported once into the single-file SQLite table,
then converted once to the multi-file local snippet table. Both earlier data
sources remain intact. Going back to the earlier prototype will not show edits
made through this interface. Snippets are stored as plaintext.

The Rust adapter supports local list, get, create, multi-file edit, and delete;
it applies edits in a database transaction. Files have a 2 MB limit. The
original Lepton renderer maintains its own local search index and tag filters.
Preferences currently use WebView local storage; they do not migrate Lepton's
existing settings. Concurrent edits to the same snippet are last-write-wins.

The prior small prototype remains in `src/`; the new entry and compatibility
bridge are in `legacy/`. Copying text uses the native Tauri clipboard plugin. Local
edits stay open until the save succeeds, and save failures leave the draft in
the editor. The browser bridge is deliberately incomplete: do not rely on
OAuth, remote URLs, OS shortcuts, file dialogs, notifications,
updates, or restart-dependent preferences until verified on each platform.
Image attachments and Jupyter, Markdown, and AsciiDoc rendering need broader
compatibility and security testing. The original editor's behavior around
unsaved changes needs further work before real use.

## Verification so far

On Apple Silicon, the original Lepton layout rendered in a packaged Tauri app.
A snippet was created, edited to add a Markdown file, and its preview rendered.
An isolated QA build also verified content search, language filtering, multi-file
creation, and persistence after reopening. Delete confirmation was opened and
cancelled; deletion itself was exercised by the Rust tests. The latest native
window was captured in [the QA screenshot](docs/lepton-local-qa.png).
Six Rust tests cover migration, search, persistence and multi-file CRUD including
rollback. These checks do not establish complete feature parity or cross-platform
behavior. The clipboard-enabled Lepton-interface build was 8.06 MiB installed, without the
OS-provided webview; it is not a full-feature size comparison. RAM has not been
measured across the complete process family.

Copying a code file and pasting it into the editor was verified in the packaged
macOS build. Automated tests cover failed local saves, retry, and clipboard errors.
