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

The Tauri prototype workflow verifies the release package formats on each
supported host using dummy OAuth credentials. It uses the Rust lockfile and
runs separately from the Rust unit and native UI checks. The macOS bundles
are ad-hoc signed; CI does not publish, notarize, or run the packaged apps.

## Prototype release packages

The separate **Rust prototype release** workflow builds macOS Apple Silicon
and Intel DMGs, a Windows x64 NSIS installer, and Linux x64 Debian and AppImage
packages. The build jobs use the existing GitHub Actions secrets
`LEPTON_GITHUB_CLIENT_ID` and `LEPTON_GITHUB_CLIENT_SECRET` from the
`prerelease` environment (or repository secrets). Both are required, including
for build-only runs. Installers are also available as workflow artifacts.

Use **Actions → Rust prototype release → Run workflow** for a build-only run
(`publish: never`, the default). To publish manually, choose `draft` or
`prerelease` and set `release_ref` to an existing tag such as `rust-v0.1.0`.
Pushing a `rust-v*` tag also builds and creates a prerelease. The tag version
must match `prototypes/tauri/src-tauri/tauri.conf.json`, and the workflow
checks out the tag's exact commit. Publishing waits for all builds and creates
a separate GitHub release; it does not overwrite an existing release or
publish to the Snap Store. Electron's `v*` release workflow is unchanged.

The OAuth app used for the Rust build must allow the loopback callback
`http://127.0.0.1/callback`; the Electron credentials alone do not guarantee
that this callback is registered. GitHub OAuth has not yet been verified in
the packaged Rust app. The client ID and secret are embedded in the binaries,
like the Electron distribution. A desktop app cannot keep a client secret
confidential; do not reuse it as a server credential. Local development can
override the bundled pair with `LEPTON_GITHUB_OAUTH_CLIENT_ID` and
`LEPTON_GITHUB_OAUTH_CLIENT_SECRET` at runtime.

The macOS builds use ad-hoc signing and are not notarized; the Windows
installer is unsigned. These are prototype artifacts, not distribution-ready
signed releases. Automatic updates still need a signed Tauri update feed and
verification key, as noted in the [parity audit](parity-audit.md).

`npm run test:ui` builds a test-only WebDriver-enabled app and exercises its
native WebView with isolated fixture data and a disposable local provider. It
launches one window and removes its temporary database. Set
`LEPTON_UI_SCREENSHOT` to save a fixture screenshot. Optionally set
`LEPTON_TEST_GITHUB_TOKEN` to test a live token connection and profile image;
the token is not passed to the app as an environment variable. WebDriver is
excluded from normal builds. From the repository root, `npm run test:unit`
runs the shared frontend tests. See [the parity audit](parity-audit.md) for
remaining gaps.
