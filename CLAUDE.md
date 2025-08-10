# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lepton is a lean code snippet manager powered by GitHub Gist, built with Electron, React, and Redux. It provides a desktop application for managing and organizing code snippets with features like unlimited public/secret snippets, tagging, markdown/Jupyter notebook support, and GitHub Enterprise integration.

## Tech Stack

- **Framework**: Electron (desktop app)
- **Frontend**: React + Redux (with Redux Thunk for async actions, Redux Form for forms)
- **Build System**: Webpack + Babel (ES6 transpilation)
- **Styling**: Sass/SCSS
- **Code Editor**: CodeMirror (via react-codemirror)
- **Linting**: ESLint with Standard config
- **Dependencies**: Uses yarn package manager

## Key Commands

### Development
```bash
# Install dependencies
yarn install

# Development build and run
yarn build && yarn start

# Watch mode for development
yarn webpack-watch

# Production build
yarn webpack-prod
```

### Building & Distribution
```bash
# Create installer for current platform
yarn dist

# Platform-specific builds
yarn dist -m    # macOS
yarn dist -w    # Windows
yarn dist -l    # Linux (requires Docker for snap)
yarn dist -wml  # All platforms
```

### Code Quality
```bash
# Lint code
yarn lint

# Check for outdated dependencies
yarn check-outdated

# Pre-version checks (runs lint + test + outdated check)
yarn preversion
```

### Testing
The `yarn test` command runs webpack in development mode (essentially a build verification). There are no formal unit tests configured - the project relies on build-time checks and manual testing.

## Architecture

### Application Structure
- `/app` - Main React application source
  - `/containers` - React container components (connected to Redux)
  - `/reducers` - Redux reducers for state management
  - `/actions` - Redux action creators
  - `/utilities` - Shared utilities (GitHub API, parser, search, etc.)
- `/configs` - Configuration files including GitHub OAuth credentials
- `/main.js` - Electron main process entry point
- `/bundle` - Webpack build output directory

### Key Components
- **GitHub API Integration**: `/app/utilities/githubApi/` - handles Gist CRUD operations
- **Theme Management**: `/app/utilities/themeManager/` - light/dark theme switching
- **Code Rendering**: Uses CodeMirror for syntax highlighting and editing
- **Search**: `/app/utilities/search/` - snippet search functionality
- **Configuration**: Uses nconf for config management, stored in `~/.leptonrc`

### GitHub OAuth Setup
The app requires GitHub OAuth credentials in `/configs/account.js`:
```js
module.exports = {
  client_id: '<your_client_id>',
  client_secret: '<your_client_secret>'
}
```
Register your application at https://github.com/settings/applications/new

## Development Notes

- **Electron Version**: Uses Electron 13.x with @electron/remote for main-renderer communication
- **ES6 Support**: Babel transpiles ES6+ to support older Electron versions
- **Hot Reloading**: Use `yarn webpack-watch` for auto-rebuilding during development
- **Styling**: Uses Sass with component-level SCSS files
- **State Management**: Redux store handles application state, actions use Redux Thunk for async operations
- **Shortcuts**: Customizable keyboard shortcuts defined in config, registered via electron-localshortcut

## Configuration

The app uses a hierarchical configuration system:
1. Default config in `/configs/defaultConfig.js`
2. User config in `~/.leptonrc` (JSON format)
3. Environment variables and command line args

Key configuration areas include theme, shortcuts, proxy settings, editor preferences, and GitHub Enterprise support.

## Important Guidelines

When working with this codebase:
- **NEVER modify `node_modules/`** - this directory contains installed dependencies and should not be edited
- **DO NOT commit `yarn.lock`** unless specifically updating dependencies - this file locks dependency versions
- **DO NOT change LICENSE files** unless told
- Focus code changes on the `/app` directory, `/configs`, `main.js`, and configuration files
- Avoid searching or reading files in `node_modules/`, `/bundle`, `/build`, `/dist` directories unless absolutely necessary