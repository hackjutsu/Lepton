# Local performance profiles

Build the production renderer, then run the profiles on the same machine and
Electron version before and after a change:

```sh
npm run webpack-prod
node node_modules/electron/cli.js tests/performance/electron-flow.cjs
node node_modules/electron/cli.js tests/performance/electron-search.cjs
```

Each run uses isolated configuration and user data. Repeat runs and compare
medians; do not run competing builds during measurement. Set
`LEPTON_PROFILE_REPO` to the path of another checkout with its own production
bundle and the same `memory-flow` and `memory-search` fixtures to compare it
with the same harness.

The flow profile uses a 100-snippet fixture and measures the first Markdown
render, editor open, Vue mode, typing, and process working sets before and
after editing. The search profile uses 1,000 snippets of 100 lines each and
measures result rendering, a two-token search, heap, DOM nodes, and process
working sets. Working sets include shared pages, so their sum is an upper-bound
indicator rather than the app's unique physical memory. On macOS, the profiles
also report the system `footprint` summary when available; it includes GPU
allocations and may be unavailable without permission. These fixtures do not
measure authentication or network fetches.
