# Build the Rust prototype

The Electron app and the Rust prototype live together in this repository. The
prototype is under `prototypes/tauri` and reuses shared React components and
configuration; it does not replace the Electron build.

Install Node.js 24 (the version in the root `.nvmrc`), Rust stable, and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your host
platform. From the repository root, install both dependency sets:

```sh
npm ci
cd prototypes/tauri
npm ci
```

The remaining commands run from `prototypes/tauri`. Build the frontend and run
the Rust unit tests with:

```sh
npm run build
npm test
```

Start a development app with `npm start`. To build platform bundles on the host
OS, run `npm run package`. For a macOS app bundle without an installer, run
`npm run package -- --bundles app`.

The Tauri configuration targets macOS, Windows, and Linux. Platform-specific
prerequisites apply, and the Windows and Linux builds and packaged apps still
need successful verification. On Apple Silicon macOS, the frontend build, Rust
unit tests, native UI tests, and app bundle command above have been run locally.

The Tauri prototype workflow builds a release bundle on each supported host:
an app bundle on macOS, a Debian package on Linux, and an NSIS installer on
Windows. It uses the Rust lockfile and runs separately from the existing Rust
unit and native UI checks. It does not sign, publish, or run the packaged apps.

`npm run test:ui` builds a test-only WebDriver-enabled app and exercises its
native WebView with isolated fixture data and a disposable local provider. It
launches one window and removes its temporary database. Set
`LEPTON_UI_SCREENSHOT` to save a fixture screenshot. Optionally set
`LEPTON_TEST_GITHUB_TOKEN` to test a live token connection and profile image;
the token is not passed to the app as an environment variable. WebDriver is
excluded from normal builds. From the repository root, `npm run test:unit`
runs the shared frontend tests. See [the parity audit](parity-audit.md) for
remaining gaps.
