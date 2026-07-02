const { getSupportedLocales } = require('./app/utilities/i18n')
const { getElectronLanguages } = require('./configs/electronLanguages')

function buildGithubPublishConfig () {
  const releaseType = process.env.LEPTON_GITHUB_RELEASE_TYPE
  return {
    provider: 'github',
    ...(releaseType ? { releaseType } : {})
  }
}

function buildSnapStorePublishConfig () {
  const channels = process.env.LEPTON_SNAP_CHANNELS
    ? process.env.LEPTON_SNAP_CHANNELS.split(',').map(channel => channel.trim()).filter(Boolean)
    : undefined

  return {
    provider: 'snapStore',
    publishAutoUpdate: false,
    ...(channels && channels.length > 0 ? { channels } : {})
  }
}

const githubPublishConfig = buildGithubPublishConfig()
const snapStorePublishConfig = buildSnapStorePublishConfig()

// Keep only app source that the Electron main process reads at runtime.
// Renderer source is compiled into bundle/app.bundle.js and does not need to
// ship separately inside app.asar.
const mainRuntimeAppFiles = [
  'app/utilities/auth/**',
  'app/utilities/electronLocalStorage.js',
  'app/utilities/electronProxy/**',
  'app/utilities/githubApi/core.js',
  'app/utilities/githubApi/fetchAdapter.js',
  'app/utilities/i18n/**',
  'app/utilities/jupyterNotebook/core.js',
  'app/utilities/logging/**',
  'app/utilities/menu/**',
  'app/utilities/startAtLogin/**',
  'app/utilities/updatePolicy.js'
]

// Packages in this list are renderer-only dependencies that webpack already
// folds into bundle/app.bundle.js. Excluding their node_modules copies trims the
// packaged archive without changing runtime module resolution.
const rendererOnlyNodeModules = [
  '@asciidoctor/core',
  '@babel/runtime',
  '@babel/runtime-corejs2',
  '@kurkle/color',
  '@mdit/helper',
  '@mdit/plugin-katex',
  '@mdit/plugin-tex',
  'asciidoctor-opal-runtime',
  'autolinker',
  'boring-avatars',
  'chart.js',
  'classnames',
  'codemirror',
  'codemirror-one-dark-theme',
  'core-js',
  'dom-helpers',
  'highlight.js',
  'highlightjs-graphql',
  'highlightjs-solidity',
  'human-readable-time',
  'katex',
  'keycode',
  'linkify-it',
  'loose-envify',
  'markdown-it',
  'markdown-it-emoji',
  'markdown-it-task-lists',
  'mdurl',
  'moment',
  'object-assign',
  'invariant',
  'js-tokens',
  'punycode.js',
  'prop-types',
  'prop-types-extra',
  'react',
  'react-bootstrap',
  'react-dom',
  'react-is',
  'react-lifecycles-compat',
  'react-overlays',
  'react-prop-types',
  'react-redux',
  'react-split-pane',
  'react-transition-group',
  'redux',
  'redux-thunk',
  'scheduler',
  'tslib',
  'uc.micro',
  'uncontrollable',
  'use-sync-external-store',
  'valid-filename',
  'warning'
]

// Some packages are renderer-only at the root, but package-manager hoisting can
// also place versions of the same package under runtime dependencies. Exclude
// only the root copy when nested copies may still be needed by main-process IPC.
const topLevelRendererOnlyNodeModules = [
  'entities'
]

// Apply package exclusions to both direct dependencies and nested copies so
// transitive renderer-only packages do not remain in the final archive.
function excludeNodeModule (packageName) {
  return [
    `!node_modules/${packageName}/**`,
    `!node_modules/**/node_modules/${packageName}/**`
  ]
}

module.exports = {
  // electron-builder processes this list in order. The allowlist keeps the app
  // payload intentionally small, and later negated patterns remove build-only
  // or renderer-only artifacts that can otherwise be pulled in through deps.
  files: [
    ...mainRuntimeAppFiles,
    'bundle/**',
    'configs/**',
    'build/icon/icon.png',
    'build/touchbar/**',
    'index.html',
    'main.js',
    'preload.js',
    'package.json',
    'license.json',
    '.all-contributorsrc',
    '!**/*.map',
    '!node_modules/@types/**',
    '!node_modules/**/node_modules/@types/**',
    ...rendererOnlyNodeModules.flatMap(excludeNodeModule),
    ...topLevelRendererOnlyNodeModules.map(packageName => `!node_modules/${packageName}/**`)
  ],
  appId: 'com.cosmox.lepton',
  // electron-builder expands these macros at packaging time.
  // eslint-disable-next-line no-template-curly-in-string
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  // Keep Electron's own locale files aligned with the locales Lepton exposes in
  // the renderer. Add new locales in the shared i18n config first, then let this
  // derived list control the packaged Electron resources.
  electronLanguages: getElectronLanguages(getSupportedLocales()),
  // macOS builds use ad-hoc signing so Gatekeeper sees a structurally valid
  // bundle without requiring a paid Apple Developer account. This still does
  // not provide Developer ID trust or notarization.
  mac: {
    category: 'public.app-category.productivity',
    identity: '-',
    hardenedRuntime: false,
    target: [
      {
        target: 'dmg',
        arch: [
          'x64',
          'arm64'
        ]
      },
      {
        target: 'zip',
        arch: [
          'x64',
          'arm64'
        ]
      }
    ],
    publish: [
      githubPublishConfig
    ],
    darkModeSupport: true
  },
  // Windows builds keep the configurable installer and an archive artifact for
  // the supported desktop architectures.
  win: {
    target: [
      {
        target: 'nsis',
        arch: [
          'x64',
          'ia32'
        ]
      },
      {
        target: '7z',
        arch: [
          'x64',
          'ia32'
        ]
      }
    ],
    publish: [
      githubPublishConfig
    ]
  },
  // NSIS settings preserve the current installer UX: guided install flow with a
  // selectable installation directory.
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  // Linux targets stay as strings because this electron-builder version validates
  // Linux target entries as scalar target names. Snap Store publishing belongs in
  // the dedicated snap config below.
  linux: {
    category: 'Development',
    target: [
      'AppImage',
      'snap'
    ],
    publish: [
      githubPublishConfig
    ]
  },
  snap: {
    publish: [
      snapStorePublishConfig
    ]
  }
}
