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
- description
- tag
- gist id

## Title And Tags

Use this pattern in the gist description to set a title and custom tags:

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

Lepton is a desktop GitHub Gist client and does not run its own sync service. Data is stored locally by the app or remotely in GitHub Gist.

## Donation

Lepton does not accept personal donations. If you want to donate, consider donating to the [Wikimedia Foundation](https://wikimediafoundation.org/wiki/Ways_to_Give), which helps sustain free knowledge through Wikipedia and related projects.

You are welcome to create an issue to share how much you contributed.

