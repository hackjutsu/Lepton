'use strict'

export default function (title, message = '') {
  let option = {
    title: title,
    body: message,
    silent: true
  }
  new Notification(option.title, option)
}
