import { remote } from 'electron'

const conf = remote.getGlobal('conf')

export function notifySuccess (title, message = '') {
  const showSuccessNotifications = conf.get('notifications:success')

  let option = { title: title, body: message, silent: true }

  if (showSuccessNotifications) {
    new Notification(option.title, option)
  }
}

export function notifyFailure (title, message = '') {
  const showFailureNotifications = conf.get('notifications:failure')

  let option = { title: title, body: message, silent: true }

  if (showFailureNotifications) {
    new Notification(option.title, option)
  }
}
