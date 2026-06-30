import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import Chart from 'chart.js/auto'
import { Image } from 'react-bootstrap'
import Modal from '../compatModal'
import { updateDashboardModalStatus } from '../../actions'
import React, { Component } from 'react'
import { t } from '../../utilities/i18n'
import { buildRadarChartConfig } from './chartConfig'

import robotocatImage from '../../utilities/octodex/robotocat.png'

import './index.scss'

class RadarChart extends Component {
  componentDidMount () {
    this.renderChart()
  }

  componentDidUpdate () {
    this.destroyChart()
    this.renderChart()
  }

  componentWillUnmount () {
    this.destroyChart()
  }

  setCanvasNode (node) {
    this.canvasNode = node
  }

  destroyChart () {
    if (this.chart) {
      this.chart.destroy()
      this.chart = null
    }
  }

  renderChart () {
    if (!this.canvasNode) return

    const context = this.canvasNode.getContext('2d')
    this.chart = new Chart(context, this.props.config)
  }

  render () {
    const { width, height } = this.props
    return (
      <canvas
        ref={ this.setCanvasNode.bind(this) }
        width={ width }
        height={ height } />
    )
  }
}

class Dashboard extends Component {
  renderDashboardSection () {
    const { gistTags } = this.props

    const langTags = Object.keys(gistTags)
      .filter(key => key.startsWith('lang@') && key !== 'lang@All')
      .sort((t1, t2) => gistTags[t2].length - gistTags[t1].length)

    const maxNum = 5
    const rawLabels = langTags.slice(0, langTags.length > maxNum ? maxNum : langTags.length)
    const data = rawLabels.map(lang => gistTags[lang].length)
    const labels = rawLabels.map(rawLabel => rawLabel.substr('@lang'.length))

    if (data.length > 2) return this.buildRadarChart(data, labels)

    return (
      <div className='dashboard-section'>
        <Image className='octocat' src={ robotocatImage } rounded/>
        <div className='greeting'>
          { t('dashboard.notEnoughData') }
        </div>
      </div>
    )
  }

  buildRadarChart (data, labels) {
    const chartConfig = buildRadarChartConfig(data, labels, t('dashboard.statsLabel'))

    return (
      <div className='dashboard-section'>
        <RadarChart config={ chartConfig } width="350" height="300"/>
        <div className='compliment'>
          { this.renderCompliments(labels[0]) }
        </div>
      </div>
    )
  }

  renderCompliments (lang) {
    if (lang === 'Other') return t('dashboard.mysteriousLanguage')
    return (
      <div>
        <div className='compliment-word'> { t('dashboard.complimentPrefix') } </div>
        <div className='compliment-word'><b> { t('dashboard.complimentMaster', { language: lang }) } </b></div>
      </div>
    )
  }

  renderSettingModalBody () {
    return (
      <div>
        { this.renderDashboardSection() }
      </div>
    )
  }

  handleCloseButtonClicked () {
    const { updateDashboardModalStatus } = this.props
    updateDashboardModalStatus('OFF')
  }

  render () {
    return (
      <Modal
        className='dashboard-modal'
        bsSize='small'
        show={ this.props.dashboardModalStatus === 'ON' }
        onHide={ this.handleCloseButtonClicked.bind(this) }>
        <Modal.Header closeButton>
          <Modal.Title>{ t('dashboard.title') }</Modal.Title>
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
    dashboardModalStatus: state.dashboardModalStatus,
    gistTags: state.gistTags
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateDashboardModalStatus: updateDashboardModalStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard)
