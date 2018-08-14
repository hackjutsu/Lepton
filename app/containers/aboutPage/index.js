'use strict'

import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Modal, Image } from 'react-bootstrap'
import LicenseInfo from '../../../license.json'
import logoImage from './logo.png'
import appInfo from '../../../package.json'
import { updateAboutModalStatus } from '../../actions'

import './index.scss'

class AboutPage extends Component {
  renderAboutSection () {
    const licenseList = []
    /* Add Evil icons license as an exception */
    licenseList.push(
      <div key='Evil icons@1.9.0' className='license-item'>
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

    return (
      <div className='about-section'>
        <div className='logo-section'>
          <Image className='logo' src={ logoImage } rounded/>
          <div>{ appInfo.name + ' v' + appInfo.version }</div>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton'>GitHub</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/issues'>Feedback</a>
          <a className='logo-sub' href='https://github.com/hackjutsu/Lepton/blob/master/LICENSE'>License</a>
        </div>
        <div className='setting-title'>Contributors</div>
        <div className='contributor-section'>
          <div className='contributor'><a href='https://github.com/hackjutsu'>hackjutsu</a></div>
          <div className='contributor'><a href='https://github.com/wujysh'>wujysh</a></div>
          <div className='contributor'><a href='https://github.com/DNLHC'>DNLHC</a></div>
          <div className='contributor'><a href='https://github.com/meilinz'>meilinz</a></div>
          <div className='contributor'><a href='https://github.com/lcgforever'>lcgforever</a></div>
          <div className='contributor'><a href='https://github.com/Calinou'>Calinou</a></div>
          <div className='contributor'><a href='https://github.com/rogersachan'>rogersachan</a></div>
          <div className='contributor'><a href='https://github.com/passerbyid'>passerbyid</a></div>
          <div className='contributor'><a href='https://github.com/YYSU'>YYSU</a></div>
          <div className='contributor'><a href='https://github.com/cixuuz'>cixuuz</a></div>
          <div className='contributor'><a href='https://github.com/Gisonrg'>Gisonrg</a></div>
          <div className='contributor'><a href='https://github.com/ArLEquiN64'>ArLEquiN64</a></div>
          <div className='contributor'><a href='https://github.com/popey'>popey</a></div>
          <div className='contributor'><a href='https://github.com/tonyxu-io'>tonyxu-io</a></div>
          <div className='contributor'><a href='https://github.com/rawrmonstar'>rawrmonstar</a></div>
          <div className='contributor'><a href='https://github.com/baybatu'>baybatu</a></div>
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
