'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Modal, Image } from 'react-bootstrap'
import LicenseInfo from '../../../license.json'
import logoImage from './logo.png'
import appInfo from '../../../package.json'
import './index.scss'

class SettingPage extends Component {

  renderAboutSection () {
    const licenseList = []
    Object.keys(LicenseInfo).forEach(item => {
      licenseList.push(
        <div key={ item } className='license-item'>
          <div className='license-project'>
            { item }
          </div>
          <div className='license-type'>License: { LicenseInfo[item].licenses }</div>
        </div>
      )
    })

    return (
      <div className='about-section'>
        <div className='logo-section'>
          <Image className='logo' src={ logoImage } rounded/>
          <div>{ appInfo.name + ' v' + appInfo.version }</div>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton'>GitHub</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/issues'>Feedback</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/blob/master/LICENSE.md'>License</a>
        </div>
        <hr/>
        <div className='setting-title'>Contributors</div>
        <div className='contributor-section'>
          <div className='contributor'><a href='https://github.com/hackjutsu'>hackjutsu</a></div>
          <div className='contributor'><a href='https://github.com/wujysh'>wujysh</a></div>
          <div className='contributor'><a href='https://github.com/meilinz'>meilinz</a></div>
          <div className='contributor'><a href='https://github.com/lcgforever'>lcgforever</a></div>
          <div className='contributor'><a href='https://github.com/Calinou'>Calinou</a></div>
          <div className='contributor'><a href='https://github.com/rogersachan'>rogersachan</a></div>
        </div>
        <hr/>
        <div>
          <div className='setting-title'>Acknowledgement</div>
          <div className='license-section'>
            { licenseList }
          </div>
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

  render () {
    return (
      <div className='preference-modal'>
        <Modal.Dialog bsSize='small'>
          <Modal.Header>
            <Modal.Title>About</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            { this.renderSettingModalBody() }
          </Modal.Body>
        </Modal.Dialog>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    preferenceModalStatus: state.preferenceModalStatus
  }
}

export default connect(mapStateToProps)(SettingPage)
