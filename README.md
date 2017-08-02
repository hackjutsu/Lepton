# Lepton

[![Build Status](https://travis-ci.org/hackjutsu/Lepton.svg?branch=master)](https://travis-ci.org/hackjutsu/Lepton)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)
[![Dependency Status](https://david-dm.org/hackjutsu/Lepton.svg?style=flat-square)](https://david-dm.org/hackjutsu/Lepton)
[![MIT Licensed](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT)


**Lepton** is a lean [GitHub Gist](https://gist.github.com/) Desktop Client based on Electron. [Checkout the latest release.](https://github.com/hackjutsu/Lepton/releases)
- Group your gists by languages
- Create/Edit/Delete gists
- Instant search
- Custom tags
- Markdown rendering
- Cross-platform support

![Screenshot](./docs/img/portfolio/stay_organized.png)

|      Organize         |  Markdown Rendering  | Immersive Mode *(⌘/Ctrl + i)* |
| :-------------:| :-----:| :-----: |
| ![Screenshot](./docs/img/portfolio/stay_organized.png) | ![Screenshot](./docs/img/portfolio/markdown.png) | ![Screenshot](./docs/img/portfolio/immersive.png)

|      Search (*⇧ + Space*)         |   Custom Tags    | GitHub Login |
| :-------------:| :-----:| :-----: |
| ![Screenshot](./docs/img/portfolio/search_bar.png) | ![Screenshot](./docs/img/portfolio/edit.png) | ![Screenshot](./docs/img/portfolio/oauth.png)

## Based on
![Based on](./docs/img/erb-logo.png)

1. Framework: [Electron](http://electron.atom.io/)
2. Bundler: [Webpack](http://webpack.github.io/docs/), [Babel](https://babeljs.io), [electron-builder](https://github.com/electron-userland/electron-builder)
3. Language: [ES2015](https://babeljs.io/docs/learn-es2015/), [Sass](http://sass-lang.com/)
4. Library: [React](https://facebook.github.io/react/), [Redux](https://github.com/reactjs/redux), [Redux Thunk](https://github.com/gaearon/redux-thunk), [Redux Form](http://redux-form.com/)
5. Lint: [ESLint](http://eslint.org/)

## Installation
- Download released binaries(macOS/Windows/Linux) from here:
[https://github.com/hackjutsu/Lepton/releases](https://github.com/hackjutsu/Lepton/releases)
- Install via Homebrew (macOS)
```bash
brew cask install lepton
```

## Development


### Install
>Only tested with Node.js v6.9.x

Clone the repository.
```Bash
$ git clone git@github.com:hackjutsu/Lepton.git
```
Install the dependencies.
```bash
$ cd Lepton && npm i
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
$ npm run pack
$ npm run start
```

## Build Installer App
>Read [electron-builder docs](https://github.com/electron-userland/electron-builder#readme) and checkout [Code Signing](https://github.com/electron-userland/electron-builder#code-signing) before building the installer app.

Build app for macOS.
```bash
$ npm run dist -- -m
```
Build app for Windows.
```bash
$ npm run dist -- -w
```
Build app for Linux.
```bash
$ npm run dist -- -l
```
Build app for macOS, Windows and Linux.
```bash
$ npm run dist -- -wml
```
Build app for the current OS with the current arch.
```bash
$ npm run dist
```

## FAQ
#### Why is my gist's language classified as "Other"?
Lepton depends on GitHub API to detect the language. If this fails, you can still put `// vim: syntax=<your_language>` at the top of the gist to specify the language.
```
// vim: syntax=javascript
let test = 'This is a javascript file'
```

#### Why I can't search the gists' content?
Currently, Lepton only supports the search for the gist's description field. This is limited by GitHub's API support.

#### How to specify the title and tags for my gist?
```
[title] description #tag1 #tag2
```

#### Can I use Lepton behind a proxy server?
Yes. Copy and paste the following snippet to `~/.leptonrc`. Create the file if it does not exist, and don't forgot to change the address to your own one.
```
{
  "proxy": {
    "enable": true,
    "address": "socks://localhost:1080"
  }
}
```

#### How to provide feedback?
Please submit an issue ticket in the [GitHub Issue page](https://github.com/hackjutsu/Lepton/issues). Or, if you like, send a [pull request](https://github.com/hackjutsu/Lepton/pulls).


## Contributors
<table id="contributors">
   <tr>
      <td><img src=https://avatars1.githubusercontent.com/u/7756581?v=3><a href="https://github.com/hackjutsu">hackjutsu</a></td>
      <td><img src=https://avatars1.githubusercontent.com/u/5550402?v=3><a href="https://github.com/wujysh">wujysh</a></td>
      <td><img src=https://avatars2.githubusercontent.com/u/14959483?v=3><a href="https://github.com/DNLHC">DNLHC</a></td>
      <td><img src=https://avatars2.githubusercontent.com/u/13786673?v=3><a href="https://github.com/meilinz">meilinz</a></td>
      <td><img src=https://avatars3.githubusercontent.com/u/5697293?v=3><a href="https://github.com/lcgforever">lcgforever</a></td>
      <td><img src=https://avatars1.githubusercontent.com/u/180032?v=3><a href="https://github.com/Calinou">Calinou</a></td>
   </tr>
   <tr>
      <td><img src=https://avatars0.githubusercontent.com/u/7173984?v=3><a href="https://github.com/rogersachan">rogersachan</a></td>
      <td><img src=https://avatars3.githubusercontent.com/u/2075566?v=3><a href="https://github.com/passerbyid">passerbyid</a></td>
      <td><img src=https://avatars2.githubusercontent.com/u/12994810?v=3><a href="https://github.com/YYSU">YYSU</a></td>
   </tr>
</table>

## License
MIT © [hackjutsu](https://github.com/hackjutsu)
