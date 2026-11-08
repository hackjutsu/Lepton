# Local development token storage

Use the regular `npm start` command (after installing dependencies and building the frontend). Unpackaged Electron and non-UI-test Rust debug builds use the existing file token storage, including when the saved preference is Auto or Encrypted. There is no extra storage mode, environment flag, or local launch command.

Sign in with a dedicated testing token once. The existing token file persists across restarts and is removed on logout. Token files are unencrypted and retain each app’s existing file-storage implementation. Existing app data and configuration locations are retained.

Development builds do not read, migrate, or delete Keychain credentials. If an account only has a Keychain token, sign in once to save its development token to the existing file store. The Keychain item is left untouched.

Packaged Electron and Rust release builds retain their existing storage preferences and credential handling. Automated Rust UI tests retain their existing fake credential store and isolated fixtures.
