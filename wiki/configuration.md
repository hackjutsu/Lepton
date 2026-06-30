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
  "proxy": {
    "enable": false,
    "address": "socks://localhost:1080"
  },
  "snippet": {
    "sorting": "updated_at",
    "sortingReverse": true,
    "expanded": true,
    "newSnippetPrivate": false
  },
  "tag": {
    "showInSnippetList": false,
    "colored": false
  },
  "gist": {
    "downloadAll": false
  },
  "editor": {
    "tabSize": 4,
    "validateFilename": true
  },
  "enterprise": {
    "enable": false,
    "host": "",
    "token": "",
    "avatarUrl": ""
  },
  "notifications": {
    "success": true,
    "failure": true
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
| `theme` | | `light` | UI theme. Supported values: `light`, `dark`, `one-dark`, `catppuccin-latte`, `catppuccin-mocha`, `solarized-light`, `solarized-dark`, `dracula`. |
| `autoUpdate` | | `false` | Enable automatic update downloads for packaged releases. |
| `startAtLogin` | | `false` | Start Lepton when the user logs in. Not supported on every Linux environment. |
| `i18n` | `locale` | `en` | Interface language. Supported values: `en`, `es`, `fr`, `ja`, `ko`, `tr`, `zh-Hans`, `zh-Hant`. |
| `avatar` | `type` | `github` | Profile image source. Use `github` for the GitHub avatar or `boring` for a generated avatar. |
| | `boringAvatarVariant` | `beam` | Variant used when `avatar.type` is `boring`. |
| `userPanel` | `hideProfilePhoto` | `false` | Hide the profile photo in the user panel. |
| `logger` | `level` | `info` | Logging level. Use `info` for normal use or `debug` when collecting diagnostic logs. |
| `proxy` | `enable` | `false` | Route GitHub API requests and Electron sessions through a proxy. |
| | `address` | `socks://localhost:1080` | Proxy address. Supports normal proxy URLs, Chromium proxy rule lists, and `pac+https://...` PAC URLs. |
| `snippet` | `sorting` | `updated_at` | Snippet order. Supported values: `updated_at`, `created_at`, `description`. |
| | `sortingReverse` | `true` | Reverse the configured snippet order. |
| | `expanded` | `true` | Expand snippets in the detail view by default. |
| | `newSnippetPrivate` | `false` | Create new snippets as secret gists by default. |
| `tag` | `showInSnippetList` | `false` | Show custom tags in snippet list rows. |
| | `colored` | `false` | Render custom tags with stable color badges. |
| `gist` | `downloadAll` | `false` | Load all authenticated gists from the authenticated gists endpoint instead of the user public-gists endpoint. |
| `editor` | `tabSize` | `4` | Tab size in spaces. |
| | `validateFilename` | `true` | Validate gist filenames before saving. |
| `enterprise` | `enable` | `false` | Enable GitHub Enterprise mode. |
| | `host` | `""` | GitHub Enterprise host, for example `github.example.com`. |
| | `token` | `""` | Personal access token with the `gist` scope. |
| | `avatarUrl` | `""` | Optional avatar image URL for GitHub Enterprise users. |
| `notifications` | `success` | `true` | Show notifications for successful actions. |
| | `failure` | `true` | Show notifications for failed actions. |
| `shortcuts` | `keyShortcutForSearch` | `Shift+Space` | Open search. |
| | `keyNewGist` | `CommandOrControl+N` | Create a snippet. |
| | `keyEditGist` | `CommandOrControl+E` | Edit the selected snippet. |
| | `keyDeleteGist` | `CommandOrControl+Delete` | Delete the selected snippet. |
| | `keySubmitGist` | `CommandOrControl+S` | Submit editor changes. |
| | `keyImmersiveMode` | `CommandOrControl+I` | Toggle immersive mode. |
| | `keyAboutPage` | `CommandOrControl+,` | Open the About page. |
| | `keyDashboard` | `CommandOrControl+D` | Open the dashboard. |
| | `keySyncGists` | `CommandOrControl+R` | Sync with GitHub Gist. |

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
