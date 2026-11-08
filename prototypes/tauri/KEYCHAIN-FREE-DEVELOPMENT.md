# Local testing without Keychain prompts

Run `npm run start:local` from this directory. Build the Electron renderer first with `npm run build` when needed.

This explicitly enables LEPTON_DEV_KEYCHAIN_FREE=1. The Electron app requires an unpackaged build; the Rust app requires a debug build. Packaged Electron and release Rust builds ignore the flag and retain their existing credential handling.

Tokens stay in process memory, including when the settings select encrypted or file storage. Sign in again after each restart. No existing credential is read, migrated, deleted, or granted broader Keychain access. Local snippets and preferences use separate development directories; tokens are not written there. Rust uses a keychain-free-development subdirectory of its app data directory; Electron uses Lepton-keychain-free-development alongside its usual app data directory.

Use `npm start` to return to the original behavior and data. Do not use Always Allow or change Keychain permissions for this workflow.
