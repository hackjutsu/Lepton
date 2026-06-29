import React from 'react'
import { getTagBadgeClassName } from './tags'

import './index.scss'

export default function TagBadges ({ tags, className = '', colored = true }) {
  if (!tags || tags.length === 0) {
    return null
  }

  const colorModeClassName = colored ? 'tag-badges-colored' : 'tag-badges-plain'
  const classNames = ['tag-badges', colorModeClassName, className].filter(Boolean).join(' ')
  return (
    <div className={ classNames }>
      { tags.map(tag => (
        <span className={ getTagBadgeClassName(tag, colored) } key={ tag }>
          { tag }
        </span>
      )) }
    </div>
  )
}
