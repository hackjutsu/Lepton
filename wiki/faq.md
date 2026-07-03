# FAQ

## My Snippet's Language Is Classified As "Other"

Lepton depends on GitHub's API to detect snippet language. If GitHub cannot classify the language, Lepton marks it as `Other`.

You can add a Vim modeline at the top of the snippet to give GitHub a language hint:

```js
// vim: syntax=javascript
let test = 'This is a javascript file'
```

## Search

The default search shortcut is `Shift + Space`.

Lepton can search these fields:

- filename
- language
- description
- tag
- snippet id
- downloaded snippet file content

Complete global content search across every snippet requires the
`snippet.downloadAll` option to be enabled before syncing. When `downloadAll` is
disabled, content search only covers snippets whose details and file content have
already been downloaded locally, such as snippets opened during the session.

See [Configuration](configuration.md#options) for the `snippet.downloadAll` option.

## Title And Tags

Use this pattern in the snippet description to set a title and custom tags:

```text
[title] description #tag1 #tag2
```

Legacy tag syntax is also supported:

```text
[title] description #tags: tag1, tag2
```

## What Is `.leptonrc`, And Where Should I Put It?

`.leptonrc` is Lepton's user configuration file. It is parsed when the app starts and is not created automatically.

Create `.leptonrc` in the home directory reported by Electron. In Lepton v1.9.0 and later, the exact path is shown on the About page (`Command/Ctrl + ,`).

See [Configuration](configuration.md) for the current template and option list.

## How Do I Add A New Interface Locale?

Adding a locale touches both the renderer catalog and the packaged Electron
locale resources:

1. Add `app/utilities/i18n/locales/<locale>.js`, using `en.js` as the complete
   key reference.
2. Import the catalog in `app/utilities/i18n/index.js`, add it to `catalogs`,
   and add the display name to `supportedLocales`.
3. Update `tests/utilities/i18n.test.js` so the new catalog is checked for key
   shape, translated values, and package-locale coverage.
4. Update the supported `i18n.locale` lists in `README.md` and
   `wiki/configuration.md`.
5. Update `configs/electronLanguages.js` if the new Lepton locale needs a
   different Electron/Chromium resource name in packaged apps.
   `electron-builder.js` derives the packaged locale list from
   `getSupportedLocales()`, so do not add a separate hard-coded list to
   `package.json`.
6. Validate with `npm run test:unit` and `npm run test:packaged-smoke`. For
   packaged builds, confirm every Lepton-supported locale is present and
   intentionally unsupported Electron locales are absent.

## Proxy

Put proxy settings in `.leptonrc`:

```json
{
  "proxy": {
    "enable": true,
    "address": "socks://localhost:1080"
  }
}
```

See [Configuration](configuration.md#options) for all proxy-related options.

## Enable GitHub Enterprise

Create a GitHub personal access token with the `gist` scope enabled. Then add your GitHub Enterprise host and token to `.leptonrc`:

```json
{
  "enterprise": {
    "enable": true,
    "host": "github.example.com",
    "token": "token_with_gist_scope",
    "avatarUrl": ""
  }
}
```

See [Configuration](configuration.md#options) for the full `enterprise` option list.

## Scope For GitHub Access Token

Lepton requires the `gist` scope.

## About Data Collection

Lepton is a desktop snippet client backed by GitHub Gist and does not run its own sync service. Data is stored locally by the app or remotely in GitHub Gist.

## Donation

Lepton does not accept personal donations. If you want to donate, consider donating to the [Wikimedia Foundation](https://wikimediafoundation.org/wiki/Ways_to_Give), which helps sustain free knowledge through Wikipedia and related projects.

You are welcome to create an issue to share how much you contributed.
