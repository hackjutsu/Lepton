'use strict'

import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { Modal, Image } from 'react-bootstrap'
import { Radar } from 'react-chartjs'
import { updateDashboardModalStatus } from '../../actions'

import './index.scss'

class Dashboard extends Component {
  renderDashboardSection () {
    const chartData = {
      labels: ["C++", "Java", "JavaScript", "Ruby", "Python", "Shell", "Others"],
      datasets: [
        {
          label: "My Language Radar",
          fillColor: "rgba(151,187,205,0.2)",
          strokeColor: "rgba(151,187,205,1)",
          pointColor: "rgba(151,187,205,1)",
          pointStrokeColor: "#fff",
          pointHighlightFill: "#fff",
          pointHighlightStroke: "rgba(151,187,205,1)",
          data: [65, 59, 90, 81, 56, 55, 40]
        }
      ]
    }
    const chartOptions = {}

    return (
      <div className='dashboard-section'>
        <Radar data={ chartData } options={ chartOptions } width="350" height="250"/>
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
          <Modal.Title>Dashboard</Modal.Title>
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
    dashboardModalStatus: state.dashboardModalStatus
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    updateDashboardModalStatus: updateDashboardModalStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard)