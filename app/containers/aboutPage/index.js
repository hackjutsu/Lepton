import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Button, Image } from 'react-bootstrap'
import electronBridge from '../../utilities/electronBridge'
import Modal from '../compatModal'
import { updateAboutModalStatus } from '../../actions'
import defaultConfig from '../../../configs/defaultConfig'
import appInfo from '../../../package.json'
import LicenseInfo from '../../../license.json'
import ContributorInfo from '../../../.all-contributorsrc'
import logoDarkImage from './logo-dark.webp'
import logoLightImage from './logo-light.webp'
import React, { Component } from 'react'
import ThemeManager, { isDarkTheme } from '../../utilities/themeManager'
import { getSupportedLocales, t } from '../../utilities/i18n'
import { preferenceRequiresRestart } from '../../utilities/config/preferences'

import './index.scss'

const conf = electronBridge.config
const { configFilePath, logFilePath } = electronBridge.globals.getPaths()
const themeManager = new ThemeManager()

const preferenceGroups = [
  {
    title: 'Appearance',
    fields: [
      {
        key: 'theme',
        label: 'Theme',
        type: 'select',
        options: [
          ['light', 'Light'], ['dark', 'Dark'], ['one-dark', 'One Dark'], ['atom-one-dark', 'Atom One Dark'],
          ['github-light', 'GitHub Light'], ['github-dark', 'GitHub Dark'],
          ['catppuccin-latte', 'Catppuccin Latte'], ['catppuccin-mocha', 'Catppuccin Mocha'],
          ['solarized-light', 'Solarized Light'], ['solarized-dark', 'Solarized Dark'],
          ['dracula', 'Dracula'], ['material-theme', 'Material'], ['ayu', 'Ayu']
        ]
      },
      { key: 'i18n:locale', label: 'Language', type: 'select', options: getSupportedLocales().map(locale => [locale.code, locale.name]) }
    ]
  },
  {
    title: 'Behavior',
    fields: [
      { key: 'autoUpdate', label: 'Automatically check for updates', type: 'checkbox' },
      { key: 'startAtLogin', label: 'Start Lepton at login', type: 'checkbox' },
      { key: 'window:closeToTray', label: 'Close window to tray', type: 'checkbox' },
      { key: 'window:minimizeToTray', label: 'Minimize window to tray', type: 'checkbox' }
    ]
  },
  {
    title: 'Profile',
    fields: [
      { key: 'avatar:type', label: 'Avatar', type: 'select', options: [['github', 'GitHub'], ['boring', 'Generated']] },
      { key: 'avatar:boringAvatarVariant', label: 'Generated avatar style', type: 'select', options: [['beam', 'Beam'], ['marble', 'Marble'], ['pixel', 'Pixel'], ['sunset', 'Sunset'], ['ring', 'Ring'], ['bauhaus', 'Bauhaus']] },
      { key: 'userPanel:hideProfilePhoto', label: 'Hide profile photo', type: 'checkbox' }
    ]
  },
  {
    title: 'Snippets and Tags',
    fields: [
      { key: 'snippet:sorting', label: 'Sort by', type: 'select', options: [['updated_at', 'Updated'], ['created_at', 'Created'], ['description', 'Description']] },
      { key: 'snippet:sortingReverse', label: 'Reverse sort order', type: 'checkbox' },
      { key: 'snippet:expanded', label: 'Expand snippets by default', type: 'checkbox' },
      { key: 'snippet:newSnippetPrivate', label: 'Create secret snippets by default', type: 'checkbox' },
      { key: 'snippet:downloadAll', label: 'Download all snippets for content search', type: 'checkbox' },
      { key: 'tag:showInSnippetList', label: 'Show tags in the snippet list', type: 'checkbox' },
      { key: 'tag:colored', label: 'Use colored tag badges', type: 'checkbox' }
    ]
  },
  {
    title: 'Editor',
    fields: [
      { key: 'editor:tabSize', label: 'Tab size', type: 'select', numeric: true, options: [[2, '2'], [4, '4'], [8, '8']] },
      { key: 'editor:validateFilename', label: 'Validate filenames', type: 'checkbox' }
    ]
  },
  {
    title: 'Notifications',
    fields: [
      { key: 'notifications:success', label: 'Show success notifications', type: 'checkbox' },
      { key: 'notifications:failure', label: 'Show failure notifications', type: 'checkbox' }
    ]
  },
  {
    title: 'Network',
    fields: [
      { key: 'proxy:enable', label: 'Use proxy', type: 'checkbox' },
      { key: 'proxy:address', label: 'Proxy address', type: 'text', placeholder: 'socks://localhost:1080' }
    ]
  },
  {
    title: 'GitHub Enterprise',
    fields: [
      { key: 'enterprise:enable', label: 'Enable GitHub Enterprise', type: 'checkbox' },
      { key: 'enterprise:host', label: 'Host', type: 'text', placeholder: 'github.example.com' },
      { key: 'enterprise:token', label: 'Personal access token', type: 'password' },
      { key: 'enterprise:avatarUrl', label: 'Avatar URL', type: 'text' }
    ]
  },
  {
    title: 'Advanced',
    fields: [
      { key: 'zoom:percent', label: 'Default zoom', type: 'number', numeric: true, min: 50, max: 300 },
      { key: 'logger:level', label: 'Log level', type: 'select', options: [['info', 'Info'], ['debug', 'Debug'], ['warn', 'Warning'], ['error', 'Error']] },
      { key: 'security:cachedAccessTokenStorage', label: 'Cached token storage', type: 'select', options: [['auto', 'Automatic'], ['encrypted', 'Encrypted'], ['file', 'File']] }
    ]
  },
  {
    title: 'Keyboard Shortcuts',
    fields: [
      { key: 'shortcuts:keyShortcutForSearch', label: 'Search', type: 'text' },
      { key: 'shortcuts:keyNewGist', label: 'New snippet', type: 'text' },
      { key: 'shortcuts:keyEditGist', label: 'Edit snippet', type: 'text' },
      { key: 'shortcuts:keyDeleteGist', label: 'Delete snippet', type: 'text' },
      { key: 'shortcuts:keySubmitGist', label: 'Save snippet', type: 'text' },
      { key: 'shortcuts:keyImmersiveMode', label: 'Immersive mode', type: 'text' },
      { key: 'shortcuts:keyAboutPage', label: 'Settings', type: 'text' },
      { key: 'shortcuts:keyDashboard', label: 'Dashboard', type: 'text' },
      { key: 'shortcuts:keySyncGists', label: 'Sync snippets', type: 'text' }
    ]
  }
]

class AboutPage extends Component {
  constructor (props) {
    super(props)
    const values = this.loadPreferences()
    this.state = {
      activeTab: 'preferences',
      error: '',
      initialValues: values,
      restartNotice: '',
      saveNotice: '',
      saving: false,
      values
    }
  }

  componentDidUpdate (previousProps) {
    if (previousProps.aboutModalStatus !== 'ON' && this.props.aboutModalStatus === 'ON') {
      const values = this.loadPreferences()
      this.setState({
        activeTab: 'preferences',
        error: '',
        initialValues: values,
        restartNotice: '',
        saveNotice: '',
        saving: false,
        values
      })
    }
  }

  loadPreferences () {
    return preferenceGroups.reduce((values, group) => {
      group.fields.forEach(field => { values[field.key] = conf.get(field.key) })
      return values
    }, {})
  }

  updatePreference (field, event) {
    const value = field.type === 'checkbox'
      ? event.target.checked
      : field.numeric ? Number(event.target.value) : event.target.value

    this.setState(state => ({
      error: '',
      restartNotice: '',
      saveNotice: '',
      values: Object.assign({}, state.values, { [field.key]: value })
    }))
  }

  getChangedPreferenceKeys () {
    return Object.keys(this.state.values).filter(key => this.state.values[key] !== this.state.initialValues[key])
  }

  applyPreferences (closeAfterSave) {
    const changedKeys = this.getChangedPreferenceKeys()
    if (changedKeys.length === 0) {
      if (closeAfterSave) this.handleCloseButtonClicked()
      return
    }

    this.setState({ error: '', restartNotice: '', saveNotice: '', saving: true })
    Promise.all(changedKeys.map(key => electronBridge.config.set(key, this.state.values[key])))
      .then(persistedValues => {
        if (persistedValues.some(value => value === undefined)) throw new Error('Preference was rejected')

        if (changedKeys.includes('theme')) themeManager.setTheme(this.state.values.theme)
        const restartFields = preferenceGroups
          .flatMap(group => group.fields)
          .filter(field => changedKeys.includes(field.key) && preferenceRequiresRestart(field.key))
        const restartRequired = restartFields.length > 0
        const restartNotice = restartRequired
          ? `Saved. Restart Lepton to apply: ${restartFields.map(field => field.label).join(', ')}.`
          : ''
        const saveNotice = restartRequired ? '' : 'Changes applied.'
        const values = Object.assign({}, this.state.values)
        this.setState({ initialValues: values, restartNotice, saveNotice, saving: false })

        if (closeAfterSave && restartRequired) {
          electronBridge.dialog.showMessage({
            title: 'Restart required',
            message: restartNotice
          }).catch(() => {})
        }
        if (closeAfterSave) this.handleCloseButtonClicked()
      })
      .catch(() => {
        this.setState({
          error: 'Could not save preferences to .leptonrc.',
          saveNotice: '',
          saving: false
        })
      })
  }

  cancelPreferences () {
    this.setState(state => ({
      error: '',
      restartNotice: '',
      saveNotice: '',
      values: Object.assign({}, state.initialValues)
    }))
    this.handleCloseButtonClicked()
  }

  renderPreferenceField (field) {
    const value = this.state.values[field.key]
    if (field.type === 'checkbox') {
      return (
        <label className='preference-checkbox' key={ field.key }>
          <input type='checkbox' checked={ Boolean(value) } onChange={ this.updatePreference.bind(this, field) } />
          <span>{ field.label }</span>
        </label>
      )
    }

    if (field.type === 'select') {
      return (
        <label className='preference-row' key={ field.key }>
          <span>{ field.label }</span>
          <select value={ value } onChange={ this.updatePreference.bind(this, field) }>
            { field.options.map(option => <option key={ option[0] } value={ option[0] }>{ option[1] }</option>) }
          </select>
        </label>
      )
    }

    return (
      <label className='preference-row' key={ field.key }>
        <span>{ field.label }</span>
        <input
          max={ field.max }
          min={ field.min }
          placeholder={ field.placeholder }
          type={ field.type }
          value={ value === undefined ? '' : value }
          onChange={ this.updatePreference.bind(this, field) } />
      </label>
    )
  }

  renderPreferencesSection () {
    return (
      <div className='preferences-section'>
        { preferenceGroups.map(group => (
          <section className='preference-group' key={ group.title }>
            <h4>{ group.title }</h4>
            { group.fields.map(this.renderPreferenceField.bind(this)) }
          </section>
        )) }
        <div className='preference-save-note'>Save or Apply writes these changes to <code>.leptonrc</code>.</div>
      </div>
    )
  }

  openFileInEditor (filePath) {
    if (filePath === configFilePath) {
      electronBridge.files.ensureConfigFile(defaultConfig)
        .then(() => electronBridge.shell.openPath(filePath))
      return
    }
    electronBridge.shell.openPath(filePath)
  }

  renderAboutSection () {
    // Get the contributor list
    const contributorList = []
    const contributors = ContributorInfo.contributors || [] // just in case the format changed
    contributors.forEach(item => {
      const contributorProfileLink = `https://github.com/${item.login}`
      contributorList.push(
        <div key={ item.login } className='contributor'>
          <a href={ contributorProfileLink }>{ item.login }</a>
        </div>
      )
    })

    // Get the license list
    const licenseList = []
    // Add Evil icons license as an exception
    licenseList.push(
      <div key ='Octodex Images' className='license-item'>
        <div className='license-project'>Octodex Images</div>
        <div className='license-type'>octodex.github.com</div>
      </div>,
      <div key ='Evil icons@1.9.0' className='license-item'>
        <div className='license-project'>Evil icons@1.9.0</div>
        <div className='license-type'>{ t('about.licenseType', { license: 'MIT' }) }</div>
      </div>
    )
    Object.keys(LicenseInfo).forEach(item => {
      if (item.startsWith(appInfo.name)) {
        return
      }
      licenseList.push(
        <div key={ item } className='license-item'>
          <div className='license-project'>
            { item }
          </div>
          <div className='license-type'>{ t('about.licenseType', { license: LicenseInfo[item].licenses }) }</div>
        </div>
      )
    })

    const logoImage = isDarkTheme(conf.get('theme')) ? logoDarkImage : logoLightImage

    return (
      <div className='about-section'>
        <div className='logo-section'>
          <Image className='logo' src={ logoImage } rounded/>
          <div>{ appInfo.name + ' v' + appInfo.version }</div>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton'>GitHub</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/issues'>{ t('about.feedback') }</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/blob/master/LICENSE'>{ t('about.license') }</a>
        </div>
        <div className='setting-title-clickable' onClick={ this.openFileInEditor.bind(this, configFilePath) }>
          { t('about.configurations') }
        </div>
        <div className='one-line-section'>{ configFilePath }</div>
        <div className='setting-title-clickable' onClick={ this.openFileInEditor.bind(this, logFilePath) }>{ t('about.logs') }</div>
        <div className='one-line-section'>{ logFilePath }</div>
        <div className='setting-title'>{ t('about.contributors') }</div>
        <div className='contributor-section'>
          { contributorList }
        </div>
        <div className='setting-title'>{ t('about.acknowledgement') }</div>
        <div className='license-section'>
          { licenseList }
        </div>
      </div>
    )
  }

  renderSettingModalBody () {
    return (
      <div className='settings-layout'>
        <nav className='settings-tabs' aria-label='Settings sections'>
          <button className={ this.state.activeTab === 'preferences' ? 'active' : '' } onClick={ () => this.setState({ activeTab: 'preferences' }) }>Preferences</button>
          <button className={ this.state.activeTab === 'about' ? 'active' : '' } onClick={ () => this.setState({ activeTab: 'about' }) }>About</button>
        </nav>
        <div className='settings-content'>
          { this.state.activeTab === 'preferences' ? this.renderPreferencesSection() : this.renderAboutSection() }
        </div>
      </div>
    )
  }

  handleCloseButtonClicked () {
    const { updateAboutModalStatus } = this.props
    updateAboutModalStatus('OFF')
  }

  renderFooter () {
    if (this.state.activeTab === 'about') {
      return <Button onClick={ this.handleCloseButtonClicked.bind(this) }>Close</Button>
    }

    const disabled = this.state.saving
    const hasChanges = this.getChangedPreferenceKeys().length > 0
    const applied = !hasChanges && !disabled && Boolean(this.state.saveNotice || this.state.restartNotice)
    return (
      <div className='preferences-footer'>
        <div className='preference-status' aria-live='polite'>
          { this.state.saving ? 'Applying changes…' : null }
          { !this.state.saving && this.state.error ? <span className='preference-error'>{ this.state.error }</span> : null }
          { !this.state.saving && this.state.restartNotice ? <span className='preference-restart-notice'>{ this.state.restartNotice }</span> : null }
          { !this.state.saving && this.state.saveNotice ? this.state.saveNotice : null }
        </div>
        <div className='preference-actions'>
          { applied
            ? <Button bsStyle='primary' onClick={ this.handleCloseButtonClicked.bind(this) }>Close</Button>
            : <div>
              <Button disabled={ disabled } onClick={ this.cancelPreferences.bind(this) }>Cancel</Button>
              <Button disabled={ disabled || !hasChanges } onClick={ this.applyPreferences.bind(this, false) }>Apply</Button>
              <Button bsStyle='primary' disabled={ disabled || !hasChanges } onClick={ this.applyPreferences.bind(this, true) }>Save</Button>
            </div> }
        </div>
      </div>
    )
  }

  render () {
    return (
      <Modal
        className='about-modal'
        show={ this.props.aboutModalStatus === 'ON' }
        onHide={ this.handleCloseButtonClicked.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          { this.renderSettingModalBody() }
        </Modal.Body>
        <Modal.Footer>
          { this.renderFooter() }
        </Modal.Footer>
      </Modal>
    )
  }
}

function mapStateToProps (state) {
  return {
    aboutModalStatus: state.aboutModalStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateAboutModalStatus: updateAboutModalStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(AboutPage)
