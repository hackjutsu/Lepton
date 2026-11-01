# Electron and Rust prototype parity audit

The migration is not yet feature complete. This audit records the comparison
on Apple Silicon macOS using the same six snippet fixtures in both apps. The
Rust fixture has a separate local library, so its local-only screen deliberately
has no remote share, history, privacy, or starred links. The GitHub account
screen does show the original remote controls.

## Compared and checked

- Active layout, profile image, language and tag filtering, combined and empty
  filters, pinned-tag dialog, dashboard, and immersive view.
- New and edit dialogs, recoverable new-snippet draft, delete confirmation and
  cancellation, raw view, copying code in earlier manual verification, search
  including file contents, Python and PHP highlighting, Markdown, image files,
  and Jupyter preview.
- Original GitHub/GitLab provider login controls, a live GitHub token login,
  GitHub avatar and starred-Gist link, and a return to the local library after
  logout. An earlier disposable GitLab test exercised create and edit in the
  native app, plus list, read, edit and delete through the Rust transport.
- Settings/About display actual `.leptonrc` and Rust log paths. A test writes an
  isolated preference file; Rust tests check that unrelated configuration
  entries survive and malformed JSON is not overwritten.
- Restored the sync timestamp and login progress messages and preserved snippet
  file order, including after deleting a file.

The original Electron smoke suite passed its fixtures, including login progress,
login errors, editor draft, image-attachment, and exit cases. The Rust UI suite
covers the screens and operations listed above; it does not yet replicate all
of Electron's interaction, login, image-attachment, or exit tests. The parity
fixture test checks that both suites use identical snippet payloads.

## Known gaps and follow-up

- A local library has no equivalent in Electron; switching to a provider uses
  the original logout and login screens. Logging out of a remote provider
  returns to the local library rather than the Electron login screen.
- Tokens are session-only. Secure remembered credentials, existing Electron
  credential migration, and live OAuth verification remain incomplete.
- Remote snippets are loaded into memory, not an offline SQLite cache. A
  truncated GitHub response currently blocks safe editing and can prevent the
  account from loading. Sync progress, failures, large accounts, and recovery
  need fuller end-to-end coverage.
- The Rust log records startup and generic warning/error events; detailed,
  redacted diagnostic logging is not yet equivalent to Electron.
- Settings are persisted, but several native settings including updates,
  start-at-login, window/tray behavior, zoom, and proxy handling need
  implementation or platform verification. Preferences requiring restart need
  a complete behavior audit.
- Login failure/expiry states, image insertion and attachment limits, file
  dialogs, notifications, OS menu/shortcut behavior, Markdown task toggles,
  account-switch races and unsaved edits need equivalent interaction tests.
- macOS is tested locally. Windows and Linux have CI configuration but still
  need successful runner results, packaged-app checks, and manual validation.

A passing fixture render does not establish complete feature parity, safety for
real data, or pixel-identical rendering across operating systems.
