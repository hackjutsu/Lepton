window.addEventListener('error', function (event) {
  var container = document.getElementById('container')
  if (container && !container.hasChildNodes()) {
    container.textContent = 'Renderer startup failed: ' + event.message + ' ' + (event.error && event.error.stack || '')
  }
})
window.addEventListener('unhandledrejection', function (event) {
  var container = document.getElementById('container')
  if (container && !container.hasChildNodes()) container.textContent = 'Renderer startup failed: ' + String(event.reason)
})
