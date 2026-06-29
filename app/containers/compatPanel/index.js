import React from 'react'

const h = React.createElement

function classNames (...values) {
  return values.filter(Boolean).join(' ')
}

function styleClass (bsStyle) {
  return bsStyle ? `panel-${bsStyle}` : 'panel-default'
}

function Panel (props) {
  const {
    bsStyle,
    children,
    className,
    ...elementProps
  } = props

  return h('div', Object.assign({}, elementProps, {
    className: classNames('panel', styleClass(bsStyle), className)
  }), children)
}

function Heading (props) {
  const { children, className, ...elementProps } = props
  return h('div', Object.assign({}, elementProps, {
    className: classNames('panel-heading', className)
  }), children)
}

function Body (props) {
  const { children, className, ...elementProps } = props
  return h('div', Object.assign({}, elementProps, {
    className: classNames('panel-body', className)
  }), children)
}

function Collapse (props) {
  const { children, className, in: expanded, ...elementProps } = props
  return h('div', Object.assign({}, elementProps, {
    className: classNames('collapse', expanded && 'in', className)
  }), children)
}

Panel.Heading = Heading
Panel.Body = Body

export { Collapse }
export default Panel
