import React, { Component, createContext } from 'react'
import ReactDOM from 'react-dom'

const ModalContext = createContext({ onHide: null })
const h = React.createElement
const openDocuments = new Map()

function classNames (...values) {
  return values.filter(Boolean).join(' ')
}

function getDocument (container) {
  if (container && container.ownerDocument) {
    return container.ownerDocument
  }
  return document
}

function updateOpenCount (doc, delta) {
  const nextCount = (openDocuments.get(doc) || 0) + delta
  if (nextCount > 0) {
    openDocuments.set(doc, nextCount)
    doc.body.classList.add('modal-open')
  } else {
    openDocuments.delete(doc)
    doc.body.classList.remove('modal-open')
  }
}

function getDialogSizeClass (bsSize) {
  if (bsSize === 'large') return 'modal-lg'
  if (bsSize === 'small') return 'modal-sm'
  return null
}

function Dialog (props) {
  const {
    bsSize,
    children,
    className,
    dialogClassName,
    style,
    ...elementProps
  } = props

  return h('div', Object.assign({}, elementProps, {
    className: classNames('modal', className),
    role: 'dialog',
    style: Object.assign({ display: 'block' }, style),
    tabIndex: '-1'
  }), h('div', {
    className: classNames('modal-dialog', getDialogSizeClass(bsSize), dialogClassName)
  }, h('div', {
    className: 'modal-content',
    role: 'document'
  }, children))
  )
}

function Header (props) {
  const {
    children,
    className,
    closeButton,
    closeLabel = 'Close',
    onHide,
    ...elementProps
  } = props

  return h(ModalContext.Consumer, null, context => {
    const handleHide = onHide || context.onHide
    return h('div', Object.assign({}, elementProps, {
      className: classNames('modal-header', className)
    }), closeButton && h('button', {
      'aria-label': closeLabel,
      className: 'close',
      onClick: handleHide,
      type: 'button'
    }, h('span', {
      'aria-hidden': 'true'
    }, String.fromCharCode(215))), children)
  })
}

function Body (props) {
  const { children, className, ...elementProps } = props
  return h('div', Object.assign({}, elementProps, {
    className: classNames('modal-body', className)
  }), children)
}

function Footer (props) {
  const { children, className, ...elementProps } = props
  return h('div', Object.assign({}, elementProps, {
    className: classNames('modal-footer', className)
  }), children)
}

function Title (props) {
  const {
    children,
    className,
    componentClass: ComponentClass = 'h4',
    ...elementProps
  } = props

  return h(ComponentClass, Object.assign({}, elementProps, {
    className: classNames('modal-title', className)
  }), children)
}

class CompatModal extends Component {
  constructor (props) {
    super(props)
    this.handleBackdropClick = this.handleBackdropClick.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
  }

  componentDidMount () {
    this.syncOpenState()
  }

  componentDidUpdate () {
    this.syncOpenState()
  }

  componentWillUnmount () {
    this.setDocumentOpen(false)
    this.removeKeyListener()
  }

  getContainer () {
    const { container } = this.props
    if (typeof container === 'function') {
      return container()
    }
    return container || document.body
  }

  setDocumentOpen (open) {
    if (this.documentOpen === open) return

    const doc = getDocument(this.getContainer())
    updateOpenCount(doc, open ? 1 : -1)
    this.documentOpen = open
  }

  addKeyListener () {
    if (this.keyListenerDocument) return

    const doc = getDocument(this.getContainer())
    doc.addEventListener('keydown', this.handleKeyDown)
    this.keyListenerDocument = doc
  }

  removeKeyListener () {
    if (!this.keyListenerDocument) return

    this.keyListenerDocument.removeEventListener('keydown', this.handleKeyDown)
    this.keyListenerDocument = null
  }

  syncOpenState () {
    if (this.props.show) {
      this.setDocumentOpen(true)
      this.addKeyListener()
    } else {
      this.setDocumentOpen(false)
      this.removeKeyListener()
    }
  }

  handleKeyDown (event) {
    if (event.keyCode === 27 && this.props.keyboard !== false && this.props.onHide) {
      this.props.onHide(event)
    }
  }

  handleBackdropClick (event) {
    if (event.target === event.currentTarget && this.props.backdrop === true && this.props.onHide) {
      this.props.onHide(event)
    }
  }

  getElementProps () {
    const elementProps = Object.assign({}, this.props)
    const modalOnlyProps = [
      'animation',
      'backdrop',
      'backdropClassName',
      'bsSize',
      'children',
      'className',
      'container',
      'dialogClassName',
      'keyboard',
      'onHide',
      'show',
      'style'
    ]

    modalOnlyProps.forEach(prop => {
      delete elementProps[prop]
    })

    return elementProps
  }

  renderModal () {
    const {
      backdrop,
      backdropClassName,
      bsSize,
      children,
      className,
      dialogClassName,
      onHide,
      style
    } = this.props
    const elementProps = this.getElementProps()

    return h(ModalContext.Provider, {
      value: { onHide }
    }, h('div', null,
      backdrop !== false && h('div', {
        className: classNames('modal-backdrop', 'in', backdropClassName),
        onClick: this.handleBackdropClick
      }),
      h(Dialog, Object.assign({}, elementProps, {
        bsSize,
        className: classNames('in', className),
        dialogClassName,
        onClick: this.handleBackdropClick,
        style
      }), children)
    ))
  }

  render () {
    if (!this.props.show) return null

    return ReactDOM.createPortal(this.renderModal(), this.getContainer())
  }
}

CompatModal.defaultProps = {
  backdrop: true,
  keyboard: true,
  show: false
}

CompatModal.Body = Body
CompatModal.Dialog = Dialog
CompatModal.Footer = Footer
CompatModal.Header = Header
CompatModal.Title = Title

export default CompatModal
