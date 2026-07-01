const { getSupportedLocales } = require('./app/utilities/i18n')
const { getElectronLanguages } = require('./configs/electronLanguages')

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
  'app/utilities/startAtLogin/**'
]

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

const topLevelRendererOnlyNodeModules = [
  'entities'
]

function excludeNodeModule (packageName) {
  return [
    `!node_modules/${packageName}/**`,
    `!node_modules/**/node_modules/${packageName}/**`
  ]
}

module.exports = {
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
  electronLanguages: getElectronLanguages(getSupportedLocales()),
  mac: {
    category: 'public.app-category.productivity',
    target: [
      {
        target: 'dmg',
        arch: [
          'x64',
          'arm64'
        ]
      },
      {
        target: '7z',
        arch: [
          'x64',
          'arm64'
        ]
      }
    ],
    publish: [
      'github'
    ],
    darkModeSupport: true
  },
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
      'github'
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  linux: {
    category: 'Development',
    target: [
      'AppImage',
      'snap'
    ],
    publish: [
      'github'
    ]
  }
}
