# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

Lepton is a lean code snippet manager powered by GitHub Gist, built with Electron, React, and Redux. It provides a desktop application for managing and organizing code snippets with features like unlimited public/secret snippets, tagging, markdown/Jupyter notebook support, and GitHub Enterprise integration.

## Tech Stack

- **Framework**: Electron (desktop app)
- **Frontend**: React + Redux (with Redux Thunk for async actions, Redux Form for forms)
- **Build System**: Webpack + Babel (ES6 transpilation)
- **Styling**: Sass/SCSS
- **Code Editor**: CodeMirror (via react-codemirror)
- **Linting**: ESLint with Standard config
- **Dependencies**: Uses npm package manager

## Key Commands

### Runtime

Use Node.js 24 LTS for local development, preferably the version in `.nvmrc`:
```bash
nvm install
nvm use
```

The project uses npm 11.x. This is the host runtime for dependency installation
and webpack builds; Electron's bundled app runtime is controlled separately by
the Electron version in `package.json`.

On Apple Silicon, use the native arm64 Node.js runtime:
```bash
npm ci
npm run build
npm start
```

### Development
```bash
# Install dependencies
npm ci

# Development build and run
npm run build && npm start

# Watch mode for development
npm run webpack-watch

# Production build
npm run webpack-prod
```

### Building & Distribution
```bash
# Create installer for current platform
npm run dist

# Platform-specific builds
npm run dist -- -m    # macOS
npm run dist -- -w    # Windows
npm run dist -- -l    # Linux (requires Docker for snap)
npm run dist -- -wml  # All platforms
```

### Code Quality
```bash
# Lint code
npm run lint

# Check for outdated dependencies
npm run check-outdated

# Pre-version checks (runs lint + test + outdated check)
npm run preversion
```

### Testing
The `npm test` command runs webpack in development mode (essentially a build verification). There are no formal unit tests configured - the project relies on build-time checks and manual testing.

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
- **Node Version**: Use Node.js 24 LTS for local development.
- **ES6 Support**: Babel transpiles ES6+ to support older Electron versions
- **Hot Reloading**: Use `npm run webpack-watch` for auto-rebuilding during development
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
- **DO NOT commit `package-lock.json` churn** unless specifically updating dependencies - this file locks dependency versions
- **DO NOT change LICENSE files** unless told
- **DO NOT commit `license.json` path-only churn** - `npm run build` regenerates local absolute paths
- Focus code changes on the `/app` directory, `/configs`, `main.js`, and configuration files
- Avoid searching or reading files in `node_modules/`, `/bundle`, `/build`, `/dist` directories unless absolutely necessary
- Avoid printing or preserving GitHub tokens from logs; current debug logs can include cached token values
