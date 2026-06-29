import { addLangPrefix as Prefixed } from './utilities/parser'

const FIXTURE_USER = {
  avatar_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  html_url: 'https://github.com/lepton-fixture',
  login: 'lepton-fixture'
}

const FILES = {
  'hello.js': {
    filename: 'hello.js',
    language: 'JavaScript',
    raw_url: 'https://gist.githubusercontent.com/lepton-fixture/mock/raw/hello.js',
    content: [
      'function hello(name) {',
      '  return "hello " + name',
      '}',
      '',
      'console.log(hello("Lepton"))'
    ].join('\n')
  },
  'notes.md': {
    filename: 'notes.md',
    language: 'Markdown',
    raw_url: 'https://gist.githubusercontent.com/lepton-fixture/mock/raw/notes.md',
    content: [
      '# Render fixture',
      '',
      '- exercises markdown rendering',
      '- keeps GitHub out of smoke tests'
    ].join('\n')
  },
  'styles.css': {
    filename: 'styles.css',
    language: 'CSS',
    raw_url: 'https://gist.githubusercontent.com/lepton-fixture/mock/raw/styles.css',
    content: [
      '.fixture {',
      '  display: grid;',
      '  gap: 8px;',
      '}'
    ].join('\n')
  }
}

function createGist (id, description, isPublic, files, updatedAt) {
  const gist = {
    id,
    description,
    public: isPublic,
    html_url: `https://gist.github.com/lepton-fixture/${id}`,
    updated_at: updatedAt,
    files
  }

  return {
    langs: new Set(Object.keys(files).map(filename => files[filename].language || 'Other')),
    brief: gist,
    details: gist
  }
}

const gists = {
  'fixture-gist-1': createGist(
    'fixture-gist-1',
    '[React 19 render fixture] #ui #smoke Covers editor, raw modal, tags, and dashboard rendering.',
    false,
    FILES,
    '2026-06-29T16:00:00Z'
  ),
  'fixture-gist-2': createGist(
    'fixture-gist-2',
    '[Python utility] #backend Small parser helper fixture.',
    true,
    {
      'parser.py': {
        filename: 'parser.py',
        language: 'Python',
        raw_url: 'https://gist.githubusercontent.com/lepton-fixture/mock/raw/parser.py',
        content: 'def parse(value):\n    return value.strip()\n'
      }
    },
    '2026-06-28T14:30:00Z'
  ),
  'fixture-gist-3': createGist(
    'fixture-gist-3',
    '[Shell setup] #ops Installs local development prerequisites.',
    true,
    {
      'setup.sh': {
        filename: 'setup.sh',
        language: 'Shell',
        raw_url: 'https://gist.githubusercontent.com/lepton-fixture/mock/raw/setup.sh',
        content: 'npm ci\nnpm run build\n'
      }
    },
    '2026-06-27T10:15:00Z'
  ),
  'fixture-gist-4': createGist(
    'fixture-gist-4',
    '[Java sample] #backend Simple class fixture for dashboard variety.',
    true,
    {
      'Example.java': {
        filename: 'Example.java',
        language: 'Java',
        raw_url: 'https://gist.githubusercontent.com/lepton-fixture/mock/raw/Example.java',
        content: 'class Example {}\n'
      }
    },
    '2026-06-26T09:00:00Z'
  )
}

const gistTags = {
  [Prefixed('All')]: ['fixture-gist-1', 'fixture-gist-2', 'fixture-gist-3', 'fixture-gist-4'],
  [Prefixed('JavaScript')]: ['fixture-gist-1'],
  [Prefixed('Markdown')]: ['fixture-gist-1'],
  [Prefixed('CSS')]: ['fixture-gist-1'],
  [Prefixed('Python')]: ['fixture-gist-2'],
  [Prefixed('Shell')]: ['fixture-gist-3'],
  [Prefixed('Java')]: ['fixture-gist-4'],
  ui: ['fixture-gist-1'],
  smoke: ['fixture-gist-1'],
  backend: ['fixture-gist-2', 'fixture-gist-4'],
  ops: ['fixture-gist-3']
}

const searchIndexRecords = Object.keys(gists).map(id => {
  const gist = gists[id].details
  const languages = Object.keys(gist.files)
    .map(filename => gist.files[filename].language || 'Other')
    .join(',')
  const filenames = Object.keys(gist.files).join(', ')

  return {
    id,
    description: gist.description,
    language: languages,
    filename: filenames
  }
})

function getBaseState () {
  return {
    aboutModalStatus: 'OFF',
    accessToken: 'fixture-token',
    activeGist: 'fixture-gist-1',
    activeGistTag: Prefixed('All'),
    authWindowStatus: 'OFF',
    dashboardModalStatus: 'OFF',
    fileExpandStatus: {},
    gistDeleteModalStatus: 'OFF',
    gistEditModalStatus: 'OFF',
    gistNewModalStatus: 'OFF',
    gistRawModal: {
      status: 'OFF',
      file: null,
      content: null,
      link: null
    },
    gists,
    gistSyncStatus: 'DONE',
    gistTags,
    immersiveMode: 'OFF',
    logoutModalStatus: 'OFF',
    newVersionInfo: {
      version: 'fixture-version',
      url: 'https://github.com/hackjutsu/Lepton/releases'
    },
    pinnedTags: ['ui', Prefixed('JavaScript')],
    pinnedTagsModalStatus: 'OFF',
    scrollRequestStatus: 'OFF',
    searchWindowStatus: 'OFF',
    syncTime: '09:00 29/06/2026',
    updateAvailableBarStatus: 'OFF',
    userSession: {
      activeStatus: 'ACTIVE',
      profile: FIXTURE_USER
    }
  }
}

function getFixtureOverrides (name) {
  switch (name) {
    case 'about':
      return { aboutModalStatus: 'ON' }
    case 'dashboard':
      return { dashboardModalStatus: 'ON' }
    case 'delete':
      return { gistDeleteModalStatus: 'ON' }
    case 'edit':
      return { gistEditModalStatus: 'ON' }
    case 'immersive':
      return { immersiveMode: 'ON' }
    case 'new':
      return { gistNewModalStatus: 'ON' }
    case 'pinned-tags':
      return { pinnedTagsModalStatus: 'ON' }
    case 'raw':
      return {
        gistRawModal: {
          status: 'ON',
          file: FILES['hello.js'].filename,
          content: FILES['hello.js'].content,
          link: FILES['hello.js'].raw_url
        }
      }
    case 'search':
      return { searchWindowStatus: 'ON' }
    case 'active':
      return {}
    default:
      return null
  }
}

export function getRenderFixture (name) {
  const overrides = getFixtureOverrides(name)
  if (!overrides) return null

  return {
    name,
    searchIndexRecords,
    state: Object.assign({}, getBaseState(), overrides)
  }
}
