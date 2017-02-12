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
![Based on](./docs_resource/erb-logo.png)

1. Framework: [Electron](http://electron.atom.io/)
2. Bundler: [Webpack](http://webpack.github.io/docs/), [Babel](https://babeljs.io), [electron-builder](https://github.com/electron-userland/electron-builder)
3. Language: [ES2015](https://babeljs.io/docs/learn-es2015/), [Sass](http://sass-lang.com/)
4. Library: [React](https://facebook.github.io/react/), [Redux](https://github.com/reactjs/redux), [Redux Thunk](https://github.com/gaearon/redux-thunk), [Redux Form](http://redux-form.com/)
5. Lint: [ESLint](http://eslint.org/)

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
Lepton depends on GitHub API to detect the language. If this fails, you can put `// vim: syntax=<your_language>` at the top of the gist to specify the language.
```
// vim: syntax=javascript
let test = 'This is a javascript file'
```

#### Why I can't search my gist's content?
Currently, Lepton only supports the search for the gist's description field.

#### How to specify the title and tags for my gist?
GitHub Gist doesn't come with the native support for 'title' and 'tag' in the description field. Lepton adds these support, if the format `[title] description #tags: tag1, tag2` is followed in the gist description field.

#### How to provide feedback?
Please submit an issue ticket in the [GitHub Issue page](https://github.com/hackjutsu/Lepton/issues). Or, if you like, send a [pull request](https://github.com/hackjutsu/Lepton/pulls).

## License
MIT © [hackjutsu](https://github.com/hackjutsu)
