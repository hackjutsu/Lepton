'use strict'

import Notifier from 'node-notifier'

export default function (title, message) {
  Notifier.notify({
    'title': title,
    'message': message,
    timeout: 3
  })
}
