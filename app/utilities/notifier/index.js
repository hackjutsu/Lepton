import { remote } from 'electron'

const conf = remote.getGlobal('conf')

export default function (title, message = '') {
  let option = {
    title: title,
    body: message,
    silent: true
  }

  if (!conf.get('disableNotification')) {
    new Notification(option.title, option)
  }
}
