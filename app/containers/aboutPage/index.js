import fs from 'fs'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Modal, Image } from 'react-bootstrap'
import { remote, shell } from 'electron'
import { updateAboutModalStatus } from '../../actions'
import defaultConfig from '../../../configs/defaultConfig'
import appInfo from '../../../package.json'
import LicenseInfo from '../../../license.json'
import ContributorInfo from '../../../.all-contributorsrc'
import logoDarkImage from './logo-dark.png'
import logoLightImage from './logo-light.png'
import React, { Component } from 'react'

import './index.scss'

const conf = remote.getGlobal('conf')
const logFilePath = remote.getGlobal('logFilePath')
const configFilePath = remote.getGlobal('configFilePath')

class AboutPage extends Component {
  openFileInEditor (filePath) {
    if (!fs.existsSync(filePath)) {
      fs.closeSync(fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2)))
    }
    shell.openPath(filePath)
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
        <div className='license-type'>License: MIT</div>
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
          <div className='license-type'>License: { LicenseInfo[item].licenses }</div>
        </div>
      )
    })

    const logoImage = conf.get('theme') === 'dark' ? logoDarkImage : logoLightImage

    return (
      <div className='about-section'>
        <div className='logo-section'>
          <Image className='logo' src={ logoImage } rounded/>
          <div>{ appInfo.name + ' v' + appInfo.version }</div>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton'>GitHub</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/issues'>Feedback</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/blob/master/LICENSE'>License</a>
        </div>
        <div className='setting-title-clickable' onClick={ this.openFileInEditor.bind(this, configFilePath) }>
            Configurations
        </div>
        <div className='one-line-section'>{ configFilePath }</div>
        <div className='setting-title-clickable' onClick={ this.openFileInEditor.bind(this, logFilePath) }>Logs</div>
        <div className='one-line-section'>{ logFilePath }</div>
        <div className='setting-title'>Contributors</div>
        <div className='contributor-section'>
          { contributorList }
        </div>
        <div className='setting-title'>Acknowledgement</div>
        <div className='license-section'>
          { licenseList }
        </div>
      </div>
    )
  }

  renderSettingModalBody () {
    return (
      <div>
        { this.renderAboutSection() }
      </div>
    )
  }

  handleCloseButtonClicked () {
    const { updateAboutModalStatus } = this.props
    updateAboutModalStatus('OFF')
  }

  render () {
    return (
      <Modal
        className='about-modal'
        bsSize='small'
        show={ this.props.aboutModalStatus === 'ON' }
        onHide={ this.handleCloseButtonClicked.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>About</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          { this.renderSettingModalBody() }
        </Modal.Body>
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
