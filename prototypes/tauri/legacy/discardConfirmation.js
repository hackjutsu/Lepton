import React from 'react'
import { Button } from 'react-bootstrap'
import Modal from '../../../app/containers/compatModal'
import { getLocale } from '../../../app/utilities/i18n'
import { getSubmitValues } from '../../../app/containers/gistEditorForm/formState'

const messages = {
  en: ['Discard changes?', 'Your unsaved changes will be lost.', 'Keep editing', 'Discard changes'],
  es: ['¿Descartar los cambios?', 'Se perderán los cambios sin guardar.', 'Seguir editando', 'Descartar cambios'],
  fr: ['Abandonner les modifications ?', 'Les modifications non enregistrées seront perdues.', 'Continuer à modifier', 'Abandonner'],
  ja: ['変更を破棄しますか？', '保存していない変更は失われます。', '編集を続ける', '変更を破棄'],
  ko: ['변경 사항을 버리시겠습니까?', '저장하지 않은 변경 사항은 사라집니다.', '계속 편집', '변경 사항 버리기'],
  tr: ['Değişiklikler atılsın mı?', 'Kaydedilmemiş değişiklikler kaybolacak.', 'Düzenlemeye devam et', 'Değişiklikleri at'],
  'zh-Hans': ['放弃修改？', '未保存的修改将会丢失。', '继续编辑', '放弃修改'],
  'zh-Hant': ['放棄變更？', '未儲存的變更將會遺失。', '繼續編輯', '放棄變更']
}

export function hasUnsavedForm (form, baselineKey) {
  return Boolean(form?.state?.values && baselineKey && JSON.stringify(getSubmitValues(form.state.values)) !== baselineKey)
}

export default function DiscardConfirmation ({ show, onKeepEditing, onDiscard }) {
  const [title, message, keep, discard] = messages[getLocale()] || messages.en
  return <Modal className='discard-editor-modal' show={ show } bsSize='small' onHide={ onKeepEditing } keyboard>
    <Modal.Header><Modal.Title>{ title }</Modal.Title></Modal.Header>
    <Modal.Body>{ message }</Modal.Body>
    <Modal.Footer>
      <Button onClick={ onKeepEditing }>{ keep }</Button>
      <Button bsStyle='danger' onClick={ onDiscard }>{ discard }</Button>
    </Modal.Footer>
  </Modal>
}
