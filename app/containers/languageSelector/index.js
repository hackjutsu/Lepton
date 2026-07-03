import electronBridge from '../../utilities/electronBridge'
import React, { Component } from 'react'
import { configureI18n, getLocale, getSupportedLocales, t, translate } from '../../utilities/i18n'

const logger = electronBridge.logger

class LanguageSelector extends Component {
  constructor (props) {
    super(props)
    this.state = {
      locale: getLocale()
    }
  }

  handleLanguageChanged (event) {
    const locale = event.target.value
    const { onBeforeChange, onChangeComplete, onChangeFailed } = this.props
    this.setState({ locale })
    Promise.resolve(onBeforeChange ? onBeforeChange(locale) : null)
      .then(() => electronBridge.config.set('i18n:locale', locale))
      .then(persistedLocale => {
        const configuredLocale = configureI18n(persistedLocale || locale)
        this.setState({ locale: configuredLocale })
        if (onChangeComplete) {
          onChangeComplete(configuredLocale)
        }
      })
      .catch(error => {
        logger.error(t('i18n.saveFailed'), error)
        this.setState({ locale: getLocale() })
        if (onChangeFailed) {
          onChangeFailed(error)
        }
      })
  }

  render () {
    const { className, compact, disabled, displayLocale, selectedLocale } = this.props
    const labelClassName = `${className || ''}${compact ? ' language-selector-compact' : ''}`.trim()
    const label = displayLocale ? translate(displayLocale, 'i18n.language') : t('i18n.language')
    return (
      <label className={ labelClassName } data-tooltip={ compact ? label : undefined }>
        <span aria-hidden={ compact ? true : undefined }>{ compact ? '🌐' : label }</span>
        <select
          aria-label={ label }
          className='form-control'
          data-role='language-selector'
          disabled={ disabled }
          tabIndex={ disabled ? -1 : undefined }
          value={ selectedLocale || this.state.locale }
          onChange={ this.handleLanguageChanged.bind(this) }>
          { getSupportedLocales().map(locale => (
            <option key={ locale.code } value={ locale.code }>
              { locale.name }
            </option>
          )) }
        </select>
      </label>
    )
  }
}

export default LanguageSelector
