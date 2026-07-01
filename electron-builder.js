const { getSupportedLocales } = require('./app/utilities/i18n')
const { getElectronLanguages } = require('./configs/electronLanguages')

module.exports = {
  files: [
    'app/**',
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
    '!**/*.map'
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
