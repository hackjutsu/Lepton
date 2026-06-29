import React from 'react'
import { getTagColorClass } from './tags'

import './index.scss'

export default function TagBadges ({ tags, className = '' }) {
  if (!tags || tags.length === 0) {
    return null
  }

  const classNames = ['tag-badges', className].filter(Boolean).join(' ')
  return (
    <div className={ classNames }>
      { tags.map(tag => (
        <span className={ `tag-badge ${getTagColorClass(tag)}` } key={ tag }>
          { tag }
        </span>
      )) }
    </div>
  )
}
