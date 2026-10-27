# Configuration

Lepton reads user configuration from a `.leptonrc` JSON file in the home directory reported by Electron. In Lepton v1.9.0 and later, the exact path is shown on the About page (`Command/Ctrl + ,`).

The file is not generated automatically. Create it if you want to override the defaults below.

## Template `.leptonrc`

```json
{
  "theme": "light",
  "autoUpdate": false,
  "startAtLogin": false,
  "i18n": {
    "locale": "en"
  },
  "window": {
    "closeToTray": false,
    "minimizeToTray": false
  },
  "avatar": {
    "type": "github",
    "boringAvatarVariant": "beam"
  },
  "userPanel": {
    "hideProfilePhoto": false
  },
  "logger": {
    "level": "info"
  },
  "security": {
    "cachedAccessTokenStorage": "auto"
  },
  "provider": {
    "type": "github"
  },
  "gitlab": {
    "host": "gitlab.com"
  },
  "proxy": {
    "enable": false,
    "address": "socks://localhost:1080"
  },
  "snippet": {
    "sorting": "updated_at",
    "sortingReverse": true,
    "expanded": true,
    "newSnippetPrivate": false,
    "downloadAll": false
  },
  "tag": {
    "showInSnippetList": false,
    "colored": false
  },
  "editor": {
    "tabSize": 4,
    "validateFilename": true,
    "imageMaxSizeKB": 512
  },
  "enterprise": {
    "enable": false,
    "host": "",
    "avatarUrl": ""
  },
  "notifications": {
    "success": true,
    "failure": true
  },
  "zoom": {
    "percent": 100
  },
  "shortcuts": {
    "keyShortcutForSearch": "Shift+Space",
    "keyNewGist": "CommandOrControl+N",
    "keyEditGist": "CommandOrControl+E",
    "keyDeleteGist": "CommandOrControl+Delete",
    "keySubmitGist": "CommandOrControl+S",
    "keyImmersiveMode": "CommandOrControl+I",
    "keyAboutPage": "CommandOrControl+,",
    "keyDashboard": "CommandOrControl+D",
    "keySyncGists": "CommandOrControl+R"
  }
}
```

## Options

| Field | Sub-field | Default | Description |
| :--- | :--- | :--- | :--- |
| `theme` | | `light` | UI theme. Supported values: `light`, `dark`, `one-dark`, `atom-one-dark`, `github-light`, `github-dark`, `catppuccin-latte`, `catppuccin-mocha`, `solarized-light`, `solarized-dark`, `dracula`, `material-theme`, `ayu`. |
| `autoUpdate` | | `false` | Enable automatic update downloads for packaged releases. |
| `startAtLogin` | | `false` | Start Lepton when the user logs in. Not supported on every Linux environment. |
| `i18n` | `locale` | `en` | Interface language. Supported values: `en`, `es`, `fr`, `ja`, `ko`, `tr`, `zh-Hans`, `zh-Hant`. |
| `window` | `closeToTray` | `false` | Hide Lepton to the tray/menu bar when the window is closed. On macOS, the normal close behavior hides the window without creating a tray item unless this is enabled. |
| | `minimizeToTray` | `false` | Hide Lepton to the tray/menu bar when the window is minimized. Currently applies on macOS. |
| `avatar` | `type` | `github` | Profile image source. Use `github` for the GitHub avatar or `boring` for a generated avatar. |
| | `boringAvatarVariant` | `beam` | Variant used when `avatar.type` is `boring`. |
| `userPanel` | `hideProfilePhoto` | `false` | Hide the profile photo in the user panel. |
| `logger` | `level` | `info` | Logging level. Use `info` for normal use or `debug` when collecting diagnostic logs. |
| `security` | `cachedAccessTokenStorage` | `auto` | Cached provider token storage. Supported values: `auto`, `encrypted`, `file`. `auto` uses file storage in development builds and Electron safeStorage in packaged builds. When safeStorage is unavailable, token updates fall back to a plaintext file under `<userData>/storage`. Cached tokens are isolated by provider and host. |
| `provider` | `type` | `github` | Snippet provider. Supported values: `github` and `gitlab`. The provider can also be selected on the login screen. |
| `gitlab` | `host` | `gitlab.com` | GitLab host for personal snippets, such as `gitlab.com` or `gitlab.example.com`. HTTPS is used when no URL scheme is supplied. |
| `proxy` | `enable` | `false` | Route provider API requests and Electron sessions through a proxy. |
| | `address` | `socks://localhost:1080` | Proxy address. Supports normal proxy URLs, Chromium proxy rule lists, and `pac+https://...` PAC URLs. |
| `snippet` | `sorting` | `updated_at` | Snippet order. Supported values: `updated_at`, `created_at`, `description`. |
| | `sortingReverse` | `true` | Reverse the configured snippet order. |
| | `expanded` | `true` | Expand snippets in the detail view by default. |
| | `newSnippetPrivate` | `false` | Create new snippets as secret snippets by default. |
| | `downloadAll` | `false` | Load all authenticated snippets and download their details during sync. Enable this for complete global content search across snippet file contents. |
| `tag` | `showInSnippetList` | `false` | Show custom tags in snippet list rows. |
| | `colored` | `false` | Render custom tags with stable color badges. |
| `editor` | `tabSize` | `4` | Tab size in spaces. |
| | `validateFilename` | `true` | Validate snippet filenames before saving. |
| | `imageMaxSizeKB` | `512` | Maximum decoded size for each newly added PNG, JPEG, GIF, or WebP image, in KB. Supported values are whole numbers from `64` through `700`; images are stored as Base64 text with their original suffix, increasing the stored size by roughly one third. |
| `enterprise` | `enable` | `false` | Enable GitHub Enterprise mode. |
| | `host` | `""` | GitHub Enterprise host, for example `github.example.com`. |
| | `avatarUrl` | `""` | Optional avatar image URL for GitHub Enterprise users. |
| `notifications` | `success` | `true` | Show notifications for successful actions. |
| | `failure` | `true` | Show notifications for failed actions. |
| `zoom` | `percent` | `100` | Default page zoom percentage. `100` is original size; use values like `80`, `120`, or `150`. |
| `shortcuts` | `keyShortcutForSearch` | `Shift+Space` | Open snippet metadata and downloaded-content search. |
| | `keyNewGist` | `CommandOrControl+N` | Create a snippet. |
| | `keyEditGist` | `CommandOrControl+E` | Edit the selected snippet. |
| | `keyDeleteGist` | `CommandOrControl+Delete` | Delete the selected snippet. |
| | `keySubmitGist` | `CommandOrControl+S` | Submit editor changes. |
| | `keyImmersiveMode` | `CommandOrControl+I` | Toggle immersive mode. |
| | `keyAboutPage` | `CommandOrControl+,` | Open the About page. |
| | `keyDashboard` | `CommandOrControl+D` | Open the dashboard. |
| | `keySyncGists` | `CommandOrControl+R` | Sync snippets with the selected provider. |

Cached credentials and new-snippet drafts are isolated by provider, host, and
account. Ambiguous legacy credentials are ignored, and legacy unscoped draft
contents are left untouched rather than assigned automatically to a same-named
account on another host.

## GitLab Personal Snippets

Select GitLab on the login screen, enter the GitLab.com or self-managed instance host, and sign in with a personal access token that has the `api` scope. Lepton supports personal snippets, including multi-file create, edit, and delete operations. GitLab OAuth and project snippets are not currently supported.

## Debug Logging

Set `logger.level` to `debug` when collecting logs for an issue report:

```json
{
  "logger": {
    "level": "debug"
  }
}
```

## Home Directory Notes

### macOS

On macOS, the home directory is your user folder under `/Users`. Place `.leptonrc` here:

```text
/Users/<CurrentUserName>/.leptonrc
```

In Finder, use `Go` > `Home` to open the home directory. Because `.leptonrc` starts with a dot, it is hidden by default; press `Command + Shift + .` to show hidden files.

### Windows

The home directory can vary by Windows distribution, but it usually starts here:

```text
C:\Users\<CurrentUserName>\.leptonrc
```

Use the About page (`Command/Ctrl + ,`) to find the exact path.

### Linux Snap Package

For the snap package, Electron may report `~/snap/lepton/current` as the home directory instead of `~`. Use the About page (`Command/Ctrl + ,`) to find the exact path.

## Questions Or Issues

Open issues and feature requests at https://github.com/hackjutsu/Lepton/issues.

## Verifying GitLab support without an account

The optional `GitLab API integration` GitHub Actions workflow runs a real,
throwaway GitLab CE server on an isolated Linux runner. Once this workflow is
on the default branch, open **Actions → GitLab API integration → Run workflow**
and select the branch to test. No GitLab.com account, customer data, repository
secrets, or personal access token is required.

The same check can run on a machine with Node.js 24 and an amd64 Linux Docker
engine (allow 6 GiB of available memory and several minutes for first startup):

```sh
npm run test:gitlab-local
```

On Apple Silicon, a dedicated Colima profile can run the official amd64 image
using Rosetta (install Apple's Rosetta first if it is not already available):

```sh
brew install colima docker
colima start lepton-gitlab --cpu 4 --memory 8 --disk 40 --vm-type vz --vz-rosetta --mount none --ssh-config=false --activate=false
DOCKER_CONTEXT=colima-lepton-gitlab npm run test:gitlab-local
colima stop lepton-gitlab
```

This profile shares no host folders and does not replace the active Docker
context. The test explicitly selects `linux/amd64` for GitLab's official image.

The runner uses the official `gitlab/gitlab-ce:latest` image by default and
prints its resolved image ID. Set `LEPTON_GITLAB_TEST_IMAGE` to an official
release tag to reproduce a particular GitLab version. The first run downloads
a large image; the downloaded image remains cached after the test.

The container exposes HTTP only on `127.0.0.1` at a temporary port. It creates
an ordinary test user and a one-day `api` token kept in process memory, then
uses Lepton's production API adapter to verify profile authentication,
private multi-file snippet creation, listing, raw content retrieval, nested
paths, task-list edits that preserve other files, file creation/rename/deletion,
Unicode content, and final deletion. It removes its temporary snippet on
failure and removes the container and its anonymous volumes on completion or
normal interruption. A forced process kill or Docker failure can prevent
cleanup; the uniquely named `lepton-gitlab-test-*` container identifies the test.
No existing GitLab server or account is contacted. Container setup and token
output are not printed.

This verifies real GitLab API behavior, but does not replace an interactive
Electron login/CRUD check, GitLab.com-specific policy checks, or verification
of a customer's self-managed version and proxy configuration. The separate
`npm run test:login-flow` command covers Electron login with a mocked server.

For real Electron-to-GitLab end-to-end verification, run
`DOCKER_CONTEXT=colima-lepton-gitlab npm run test:gitlab-e2e` with the Colima
profile running (or omit `DOCKER_CONTEXT` for your normal Docker engine).
This builds and launches the actual app with isolated configuration and user
data, drives UI controls, and checks persisted results on the disposable
server. It covers login, private/public creation, multi-file edits and removal,
Markdown tasks, raw/copy/share, metadata/content search, tags and pins, external
updates and sync, rich-format rendering, preferences, immersive mode, restart,
lazy loading, failed-save draft recovery, deletion, and logout/login.
App-menu commands are exercised; native OS accelerator delivery is not covered.
Screenshots remain in the printed temporary artifact directory; credentials and
user-data directories are removed. Linux requires a display (for example Xvfb).

For login spacing, `npm run test:login-layout` exercises both providers, GitHub
OAuth/token modes, GitLab host errors, all eight interface locales, the minimum
window size, and 100%, 150%, and 300% zoom. It checks outer margins, control
padding, horizontal overflow, and whether the submit button is reachable by
scrolling, and captures screenshots at the minimum window size.

### Importing files

In the New/Edit dialog, drop code, UTF-8 text files, or supported images into the file area, or use **Choose files** to select multiple files. Text files up to 700 KB are imported as editable snippet files with their filenames and content preserved. Images use the configured image limit above. Duplicate filenames receive a numbered suffix. Unsupported binary files and non-UTF-8 text are rejected. Use **Create file** to focus an empty editor or add a new blank file. Dropping files into a code editor also imports them; images dropped or pasted into a Markdown editor additionally insert image references.
