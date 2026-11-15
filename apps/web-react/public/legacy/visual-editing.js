/* Editor-only annotations for the terminal iframe.
 * Stays inert until the React shell, already confirmed by Directus, sends
 * editorial targets. It does not read accounts, submit orders, or change layout.
 * srcdoc documents report location.origin as "null". postMessage rejects that
 * target and would surface as an uncaught page error, so messages use the
 * parent document's origin instead.
 */
(function () {
  if (window.parent === window || !document.body) return
  var entries = []
  function norm(value) { return String(value || '').replace(/\s+/g, ' ').trim() }
  function postParent(message) {
    try {
      var origin = window.parent.location.origin
      if (!/^https?:\/\//.test(origin)) return
      window.parent.postMessage(message, origin)
    } catch (error) { /* cross-origin parent: do not throw into the terminal */ }
  }
  function bind() {
    var unique = new Map()
    entries.forEach(function (entry) {
      if (!entry || !entry.text || !entry.attribute || entry.match === 'file') return
      var previous = unique.get(entry.text)
      if (previous === undefined) unique.set(entry.text, entry)
      else if (previous && previous.attribute !== entry.attribute) unique.set(entry.text, null)
    })
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    var node = walker.nextNode()
    while (node) {
      var text = norm(node.textContent)
      var parent = node.parentElement
      var entry = unique.get(text)
      if (parent && entry && norm(parent.textContent) === text && !parent.closest('script,style,textarea,canvas,svg')) {
        parent.setAttribute('data-directus', entry.attribute)
      }
      node = walker.nextNode()
    }
    document.querySelectorAll('img').forEach(function (img) {
      entries.forEach(function (entry) {
        if (entry && entry.match === 'file' && entry.text && (img.getAttribute('src') || '').indexOf(entry.text) >= 0) img.setAttribute('data-directus', entry.attribute)
      })
    })
  }
  window.addEventListener('message', function (event) {
    var allowed = ''
    try { allowed = window.parent.location.origin } catch (error) { allowed = '' }
    if (event.source !== window.parent) return
    if (event.origin !== allowed && event.origin !== location.origin) return
    var data = event.data || {}
    if (data.type !== 'openfund-visual-session' || !Array.isArray(data.entries)) return
    entries = data.entries
    bind()
  })
  document.addEventListener('click', function (event) {
    var element = event.target && event.target.closest && event.target.closest('[data-directus]')
    if (!element) return
    event.preventDefault()
    event.stopPropagation()
    var rect = element.getBoundingClientRect()
    postParent({ type: 'openfund-visual-edit', attribute: element.getAttribute('data-directus'), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, left: rect.left } })
  }, true)
  postParent({ type: 'openfund-visual-hello' })
})()
