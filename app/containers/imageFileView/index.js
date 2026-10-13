import React, { Component } from 'react'
import { t } from '../../utilities/i18n'

import './index.scss'

const { inspectImageFile } = require('../../utilities/imageAttachments')

export default class ImageFileView extends Component {
  constructor (props) {
    super(props)
    this.state = {
      imageFailed: false,
      mode: 'render'
    }
  }

  componentDidUpdate (previousProps) {
    if (
      previousProps.filename !== this.props.filename ||
      previousProps.content !== this.props.content ||
      previousProps.encoding !== this.props.encoding ||
      previousProps.rawUrl !== this.props.rawUrl
    ) {
      this.setState({ imageFailed: false, mode: 'render' })
    }
  }

  setMode (mode) {
    this.setState({ mode })
  }

  render () {
    const { filename, content, encoding, rawUrl, size, truncated } = this.props
    const file = {
      filename,
      content,
      encoding,
      raw_url: rawUrl,
      size,
      truncated
    }
    const inspected = inspectImageFile(file)
    const canRender = inspected.valid && Boolean(inspected.source) && !this.state.imageFailed
    const canShowBase64 = typeof content === 'string' && content.length > 0
    const mode = this.state.mode === 'base64' && canShowBase64 ? 'base64' : 'render'

    return (
      <div className='image-file-view'>
        <div className='image-file-view-toolbar' role='group' aria-label={ t('editor.imageView') }>
          <button
            type='button'
            className={ mode === 'render' ? 'active' : '' }
            aria-pressed={ mode === 'render' }
            disabled={ !canRender }
            onClick={ this.setMode.bind(this, 'render') }>
            { t('editor.imageRender') }
          </button>
          <button
            type='button'
            className={ mode === 'base64' ? 'active' : '' }
            aria-pressed={ mode === 'base64' }
            disabled={ !canShowBase64 }
            onClick={ this.setMode.bind(this, 'base64') }>
            { t('editor.imageBase64') }
          </button>
        </div>
        { mode === 'base64'
          ? <textarea
            aria-label={ t('editor.imageBase64') }
            className='image-file-base64'
            readOnly
            spellCheck={ false }
            wrap='off'
            value={ content } />
          : canRender
            ? <div className='image-file-preview'>
              <img
                alt={ filename }
                draggable={ false }
                src={ inspected.source }
                onError={ () => this.setState({ imageFailed: true }) } />
            </div>
            : <div className='image-file-error'>{ t('editor.imageUnavailable') }</div> }
      </div>
    )
  }
}
