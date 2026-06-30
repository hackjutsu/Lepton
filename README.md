<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-31-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

![](./docs/img/new_logo.png)

[![MIT Licensed](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT)
[![lepton](https://snapcraft.io/lepton/badge.svg)](https://snapcraft.io/lepton)

**Lepton** is a lean code snippet manager powered by GitHub Gist. [Check out the latest release.](https://github.com/hackjutsu/Lepton/releases)

## Features
- Unlimited public/secret snippets
- Unlimited tags
- Language groups
- Markdown/JupyterNotebook
- [GitHub Enterprise](wiki/faq.md#enable-github-enterprise)
- GitHub token
- Immersive mode
- [Customizable](wiki/configuration.md)
- Built-in themes
- macOS/Win/Linux
- Dashboard
- [Search](wiki/faq.md#search)
- [Proxy](wiki/faq.md#proxy)
- Free

![Screenshot](./docs/img/portfolio/stay_organized.png)

| [Light Theme](https://github.com/hackjutsu/Lepton#customization)     | [Dark Theme](https://github.com/hackjutsu/Lepton#customization)    |
| :-------------:| :-----:|
|![Screenshot](./docs/img/portfolio/lepton-light.png)|![Screenshot](./docs/img/portfolio/lepton-dark.png)|

|      Organize         |  Markdown | Jupyter Notebook |
| :-------------:| :-----:| :-----: |
| ![Screenshot](./docs/img/portfolio/stay_organized.png) | ![Screenshot](./docs/img/portfolio/markdown.png) | ![Screenshot](./docs/img/portfolio/jupyterNotebook.png) |

|      Search (*⇧ + Space*)         |    Immersive Mode *(⌘/Ctrl + i)*    | Dashboard *(⌘/Ctrl + d)* |
| :-------------:| :-----:| :-----: |
| ![Screenshot](./docs/img/portfolio/search_bar.png) | ![Screenshot](./docs/img/portfolio/immersive.png) | ![Screenshot](./docs/img/portfolio/dashboard.png)


## Shortcuts
| Function       | Shortcut       |  Note     |
| :------------: |:-------------: |:-----:|
| New Snippet    | `Cmd/Ctrl + N` | Create a snippet      |
| Edit Snippet   | `Cmd/Ctrl + E` | Edit a snippet      |
| Delete Snippet   | `Cmd/Ctrl + Del` | Delete selected snippet      |
| Submit         | `Cmd/Ctrl + S` | Submit the changes from the editor      |
| Sync           | `Cmd/Ctrl + R` | Sync with remote Gist server   |
| Immersive Mode | `Cmd/Ctrl + I` |  Toggle the [Immersive mode](https://github.com/hackjutsu/Lepton/blob/master/docs/img/portfolio/immersive.png)    |
| Dashboard      | `Cmd/Ctrl + D` |  Toggle the [dashboard](https://github.com/hackjutsu/Lepton/blob/master/docs/img/portfolio/dashboard.png)     |
| About Page     | `Cmd/Ctrl + ,` |  Toggle the [About page](https://github.com/hackjutsu/Lepton/blob/dev/docs/img/portfolio/about.png)    |
| Search         | `Shift + Space`|  Toggle the [search bar](https://github.com/hackjutsu/Lepton/blob/master/docs/img/portfolio/search_bar.png)    |

## Customization
Lepton's can be customized by `<home_dir>/.leptonrc`! You can find its exact path in the About page by `Command/Ctrl + ,`. Create the file if it does not exist.

- Theme (`light`, `dark`, `one-dark`, `atom-one-dark`, `github-light`, `github-dark`, `catppuccin-latte`, `catppuccin-mocha`, `solarized-light`, `solarized-dark`, `dracula`, `material-theme`, or `ayu`)
- Snippet
- Gist
- Editor
- Logger
- Proxy
- Shortcuts
- Enterprise
- Notifications
- Interface language (`i18n.locale`: `en`, `es`, `fr`, `ja`, `ko`, `tr`, `zh-Hans`, or `zh-Hant`)

Check out the [configuration docs](wiki/configuration.md) to explore different customization options.

Example:

```json
{
  "i18n": {
    "locale": "ja"
  }
}
```

## Tech Stack
![Based on](./docs/img/erb-logo.png)

1. Framework: [Electron](http://electron.atom.io/)
2. Bundler: [Webpack](http://webpack.github.io/docs/), [Babel](https://babeljs.io), [electron-builder](https://github.com/electron-userland/electron-builder)
3. Language: ES6, Sass/SCSS
4. UI/state: React 19, Redux, React Redux, Redux Thunk
5. Editor/rendering: CodeMirror, Highlight.js, Markdown/Jupyter rendering
6. Tests/lint: Vitest, Electron smoke tests, ESLint

Now you can learn about Lepton project's code structure in [DeepWiki](https://deepwiki.com/hackjutsu/Lepton)!

## Installation
- macOS/Windows/Linux: Download [the released packages](https://github.com/hackjutsu/Lepton/releases)
- macOS: Install via Homebrew
```bash
brew install --cask lepton
```
- Linux: Install via [Snap Store](https://snapcraft.io/lepton)
```bash
snap install lepton
```
![Based on](./docs/img/lepton-ubuntu-tweet2.png)

## Development

### Runtime requirements

Lepton's current development toolchain is known to work with Node.js 24 LTS and
npm 11.x. This is the host runtime used to install dependencies and run the
webpack build; the bundled Electron app runtime is managed by the Electron
version in `package.json`.

Recommended:

- Node.js 24.18.0
- npm 11.16.x

If you use `nvm`, the repository includes an `.nvmrc`:

```bash
$ nvm install
$ nvm use
```

Apple Silicon development should use the native arm64 Node.js runtime.

### Install dependencies

```bash
$ git clone https://github.com/hackjutsu/Lepton.git
$ cd Lepton
$ npm ci
```

```bash
# inspect stale dependencies
$ npm run check-outdated
```

### Client ID/Secret
[Register your application](https://github.com/settings/applications/new), and put your client id and client secret in `./configs/account.js`.
```js
module.exports = {
  client_id: <your_client_id>,
  client_secret: <your_client_secret>
}
```

### Run
```bash
$ npm run build && npm start
```

For iterative renderer work, run webpack in watch mode in one terminal and
restart Electron from another terminal when needed:

```bash
$ npm run webpack-watch
$ npm start
```

### Build

```bash
# Development bundle
$ npm run build

# Production bundle
$ npm run webpack-prod
```

### Automated Validation

Use these commands before opening a pull request:

```bash
# Lint application source
$ npm run lint

# Normal local check: Vitest unit tests plus webpack development build
$ npm test

# Unit tests only
$ npm run test:unit

# Unit tests in watch mode
$ npm run test:unit:watch
```

The project also has Electron smoke checks. These are useful for Electron,
React, layout, preload, or packaging changes, and are run by CI.

```bash
# Launches Electron with isolated config/user-data and verifies login plus
# fixture-backed authenticated renderer surfaces
$ npm run test:smoke

# Builds an unpacked app and verifies the packaged app can render the login UI.
# This is primarily for macOS CI or release verification.
$ npm run test:packaged-smoke
```

Renderer smoke fixtures are opt-in through the smoke runner and use deterministic
mock state to check initial rendering. Fixture names include `active`, `edit`,
`new`, `about`, `dashboard`, `search`, `delete`, `raw`, `pinned-tags`, and
`immersive`.

```bash
# Launch one fixture directly when debugging the automated smoke check
$ npm run build
$ LEPTON_RENDER_FIXTURE=active npm start
```

Fixtures verify that important React surfaces mount without renderer warnings,
errors, failed loads, or crashes. They do not verify GitHub OAuth, Gist CRUD,
sync behavior, real API responses, OS shortcut delivery, or full interaction
flows.

GitHub Actions currently runs:

- `lint-test-build`: lint, unit tests, and webpack build verification
- `electron-smoke`: Electron renderer smoke test
- `packaged-smoke`: packaged app smoke test

The smoke jobs are currently configured as non-blocking CI checks while the
cross-platform Electron validation continues to mature.

### Manual Verification

For UI or Electron changes, also launch the app locally:

```bash
$ npm run build && npm start
```

Confirm the login page visibly renders. After login, manually verify the
surfaces affected by your change, such as new snippet, edit snippet,
settings/about, dashboard, search, sync, and GitHub/Gist backend interactions.
Manual verification is still required for visual quality and real GitHub
behavior; automated smoke checks do not replace backend workflow testing.

## Build Installer App
>Read [electron-builder docs](https://github.com/electron-userland/electron-builder#readme) and check out the [code signing wiki](https://github.com/electron-userland/electron-builder#code-signing) before building the installer app.

Build an unpacked app for the current platform.
```bash
$ npm run pack
```
Build apps for macOS.
```bash
$ npm run dist -- -m
```
Build apps for Windows.
```bash
$ npm run dist -- -w
```
Build apps for Linux.

>Need a running [Docker](https://www.docker.com/) daemon to build a `snap` package.
```bash
$ npm run dist -- -l
```
Build apps for macOS, Windows and Linux.
```bash
$ npm run dist -- -wml
```
Build apps for the current OS with the current arch.
```bash
$ npm run dist
```

## FAQ
[--> Wiki FAQ](wiki/faq.md)

## Contributors
<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://airbnb.io/"><img src="https://avatars3.githubusercontent.com/u/7756581?v=4?s=100" width="100px;" alt="CosmoX"/><br /><sub><b>CosmoX</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=hackjutsu" title="Code">💻</a> <a href="#design-hackjutsu" title="Design">🎨</a> <a href="https://github.com/hackjutsu/Lepton/commits?author=hackjutsu" title="Tests">⚠️</a> <a href="#maintenance-hackjutsu" title="Maintenance">🚧</a> <a href="#platform-hackjutsu" title="Packaging/porting to new platform">📦</a> <a href="#ideas-hackjutsu" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://loveac.cn"><img src="https://avatars1.githubusercontent.com/u/5550402?v=4?s=100" width="100px;" alt="Jiaye Wu"/><br /><sub><b>Jiaye Wu</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=wujysh" title="Code">💻</a> <a href="#maintenance-wujysh" title="Maintenance">🚧</a> <a href="#ideas-wujysh" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/DNLHC"><img src="https://avatars1.githubusercontent.com/u/14959483?v=4?s=100" width="100px;" alt="Danila"/><br /><sub><b>Danila</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=DNLHC" title="Code">💻</a> <a href="#design-DNLHC" title="Design">🎨</a> <a href="#maintenance-DNLHC" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.meilinzhan.com/"><img src="https://avatars2.githubusercontent.com/u/13786673?v=4?s=100" width="100px;" alt="Meilin Zhan"/><br /><sub><b>Meilin Zhan</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=meilinz" title="Code">💻</a> <a href="#ideas-meilinz" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-meilinz" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.linkedin.com/in/liuchenguang"><img src="https://avatars1.githubusercontent.com/u/5697293?v=4?s=100" width="100px;" alt="lcgforever"/><br /><sub><b>lcgforever</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=lcgforever" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/passerbyid"><img src="https://avatars1.githubusercontent.com/u/2075566?v=4?s=100" width="100px;" alt="Yuer Lee"/><br /><sub><b>Yuer Lee</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=passerbyid" title="Documentation">📖</a> <a href="#platform-passerbyid" title="Packaging/porting to new platform">📦</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://yysu.github.io/About-me"><img src="https://avatars3.githubusercontent.com/u/12994810?v=4?s=100" width="100px;" alt="Su,Yen-Yun"/><br /><sub><b>Su,Yen-Yun</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=YYSU" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://cixuuz.github.io/"><img src="https://avatars3.githubusercontent.com/u/26782336?v=4?s=100" width="100px;" alt="Chen Tong"/><br /><sub><b>Chen Tong</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=cixuuz" title="Code">💻</a> <a href="#ideas-cixuuz" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-cixuuz" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Gisonrg"><img src="https://avatars0.githubusercontent.com/u/4332224?v=4?s=100" width="100px;" alt="Jason Jiang"/><br /><sub><b>Jason Jiang</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=Gisonrg" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://popey.com/"><img src="https://avatars0.githubusercontent.com/u/1841272?v=4?s=100" width="100px;" alt="Alan Pope"/><br /><sub><b>Alan Pope</b></sub></a><br /><a href="#platform-popey" title="Packaging/porting to new platform">📦</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://tonyxu.io"><img src="https://avatars3.githubusercontent.com/u/6280136?v=4?s=100" width="100px;" alt="Tony Xu"/><br /><sub><b>Tony Xu</b></sub></a><br /><a href="#platform-tonyxu-io" title="Packaging/porting to new platform">📦</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://tegan.lol"><img src="https://avatars0.githubusercontent.com/u/13814048?v=4?s=100" width="100px;" alt="Tegan Churchill"/><br /><sub><b>Tegan Churchill</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=rawrmonstar" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/AngieW0908"><img src="https://avatars3.githubusercontent.com/u/26016229?v=4?s=100" width="100px;" alt="Angie Wang"/><br /><sub><b>Angie Wang</b></sub></a><br /><a href="#design-AngieW0908" title="Design">🎨</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://batuhanbayrakci.com"><img src="https://avatars0.githubusercontent.com/u/965804?v=4?s=100" width="100px;" alt="Batuhan Bayrakci"/><br /><sub><b>Batuhan Bayrakci</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=baybatu" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://samuelmeuli.com"><img src="https://avatars0.githubusercontent.com/u/22477950?v=4?s=100" width="100px;" alt="Samuel Meuli"/><br /><sub><b>Samuel Meuli</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=samuelmeuli" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/alexandreamadocastro"><img src="https://avatars2.githubusercontent.com/u/5918765?v=4?s=100" width="100px;" alt="Alexandre Amado de Castro"/><br /><sub><b>Alexandre Amado de Castro</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=alexandreamadocastro" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://abner.space/"><img src="https://avatars2.githubusercontent.com/u/1998649?v=4?s=100" width="100px;" alt="Abner Soares Alves Junior"/><br /><sub><b>Abner Soares Alves Junior</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=abnersajr" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://seanz.me"><img src="https://avatars0.githubusercontent.com/u/5442563?v=4?s=100" width="100px;" alt="Sean"/><br /><sub><b>Sean</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=seancheung" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/moia-sven-ole"><img src="https://avatars0.githubusercontent.com/u/32508538?v=4?s=100" width="100px;" alt="Ole"/><br /><sub><b>Ole</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=moia-sven-ole" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/GabrielNicolasAvellaneda/"><img src="https://avatars3.githubusercontent.com/u/1248101?v=4?s=100" width="100px;" alt="Gabriel Nicolas Avellaneda"/><br /><sub><b>Gabriel Nicolas Avellaneda</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=GabrielNicolasAvellaneda" title="Code">💻</a> <a href="https://github.com/hackjutsu/Lepton/commits?author=GabrielNicolasAvellaneda" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://dideler.github.io"><img src="https://avatars2.githubusercontent.com/u/497458?v=4?s=100" width="100px;" alt="Dennis Ideler"/><br /><sub><b>Dennis Ideler</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=dideler" title="Code">💻</a> <a href="#ideas-dideler" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/hackjutsu/Lepton/commits?author=dideler" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://AnthonyAttard.com"><img src="https://avatars0.githubusercontent.com/u/8838135?v=4?s=100" width="100px;" alt="Anthony Attard"/><br /><sub><b>Anthony Attard</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=anthonyattard" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ArLEquiN64.github.io/"><img src="https://avatars1.githubusercontent.com/u/7821318?v=4?s=100" width="100px;" alt="ArLE"/><br /><sub><b>ArLE</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=ArLEquiN64" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.polnetwork.com"><img src="https://avatars1.githubusercontent.com/u/639877?v=4?s=100" width="100px;" alt="Pol Maresma"/><br /><sub><b>Pol Maresma</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=polnetwork" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://blog.jubeat.net"><img src="https://avatars.githubusercontent.com/u/11289158?v=4?s=100" width="100px;" alt="PM Extra"/><br /><sub><b>PM Extra</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=PMExtra" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://zava.carrd.co/"><img src="https://avatars.githubusercontent.com/u/1155199?v=4?s=100" width="100px;" alt="Zava"/><br /><sub><b>Zava</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=EdZava" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.linkedin.com/in/jasonralexander"><img src="https://avatars.githubusercontent.com/u/1030838?v=4?s=100" width="100px;" alt="Jason R Alexander"/><br /><sub><b>Jason R Alexander</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=sunnysidesounds" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://irrelevant.at"><img src="https://avatars.githubusercontent.com/u/279378?v=4?s=100" width="100px;" alt="Sebastian Hojas"/><br /><sub><b>Sebastian Hojas</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=Sebastian-Hojas" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yuhang-dong"><img src="https://avatars.githubusercontent.com/u/20642641?v=4?s=100" width="100px;" alt="董雨航"/><br /><sub><b>董雨航</b></sub></a><br /><a href="https://github.com/hackjutsu/Lepton/commits?author=yuhang-dong" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://sxyz.blog"><img src="https://avatars.githubusercontent.com/u/17523360?v=4?s=100" width="100px;" alt="sxyazi"/><br /><sub><b>sxyazi</b></sub></a><br /><a href="#platform-sxyazi" title="Packaging/porting to new platform">📦</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://megabyte.space"><img src="https://avatars.githubusercontent.com/u/59970525?v=4?s=100" width="100px;" alt="Brian Zalewski"/><br /><sub><b>Brian Zalewski</b></sub></a><br /><a href="#platform-ProfessorManhattan" title="Packaging/porting to new platform">📦</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License
MIT © [hackjutsu](https://github.com/hackjutsu)
