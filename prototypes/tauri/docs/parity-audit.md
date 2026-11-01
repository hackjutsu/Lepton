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
- Sized the sidebar SVG icons explicitly so WebKit displays them as in Electron;
  both native apps were rendered with fixtures after the change.
- GitHub writes return a safely reconstructed result when the server confirms a
  save but its subsequent refresh fails. A mock-provider test covers create and
  edit in that condition.

The original Electron smoke suite passed its fixtures, including login progress,
login errors, editor draft, image-attachment, and exit cases. The Rust UI suite
covers the screens and operations listed above; it does not yet replicate all
of Electron's interaction, login, image-attachment, or exit tests. The parity
fixture test checks that both suites use identical snippet payloads.

## Known gaps and follow-up

- A local library has no equivalent in Electron; switching to a provider uses
  the original logout and login screens. Logging out returns to the original
  login screen; restarting opens the local library if no account is saved.
- Secure remembered credentials and an account-scoped SQLite snapshot have
  been implemented. A disposable native Keychain entry passed on macOS, and a
  single-window mock GitHub test covered invalid credentials, a remote edit,
  Markdown task toggling and offline startup with a cached account. Windows,
  Linux, GitLab offline behavior, and other recovery cases still need end-to-end testing.
  Existing Electron credential migration and live OAuth verification remain
  incomplete.
- GitHub files individually truncated by the API are fetched from their trusted
  raw URL; a disposable private Gist over 1 MiB passed a live round trip. Gists
  whose entire file list is truncated and files over 10 MiB still require safe
  handling. Sync failures and large accounts need fuller end-to-end coverage.
- The Rust log now records redacted renderer messages, but timestamp, rotation,
  main-process coverage, and diagnostic parity still need verification.
- Settings are persisted. Native zoom and restart-only preference behavior are
  covered by the macOS UI suite. Native notification and start-at-login bridges
  are exercised with isolated test substitutes; actual operating-system delivery
  and login startup still need platform verification. A mock HTTP proxy test
  verifies provider routing, and HTTP/SOCKS proxy URLs are accepted. PAC and
  multi-rule proxies, updates, window/tray behavior, and other preference
  behavior remain incomplete.
- GitLab still needs the same post-save refresh recovery as GitHub, and a
  request interrupted before the server responds can leave a save outcome
  uncertain for either provider.
- Login expiry and additional failure states, image insertion and attachment limits, file
  dialogs, notifications, OS menu/shortcut behavior,
  account-switch races and unsaved edits need equivalent interaction tests.
- macOS is tested locally. Windows and Linux have CI configuration but still
  need successful runner results, packaged-app checks, and manual validation.

A passing fixture render does not establish complete feature parity, safety for
real data, or pixel-identical rendering across operating systems.
