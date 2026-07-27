/**
 * 首页副标题：整段多行打字机；
 * 每个字刚出现时为浅青，再过渡到暖白奶油色（颜色由 CSS 控制）。
 * 打完后停留，不再回删重打。
 */
(function () {
  const TYPE_SPEED = 120
  const START_DELAY = 300

  function normalizeStrings (str) {
    const list = Array.isArray(str) ? str : [str]
    // 保留换行，三句作为同一段一起显示，不拆成轮播单句
    return list
      .map(item => String(item || '').replace(/\r\n/g, '\n').trim())
      .filter(Boolean)
  }

  function createFadingTypewriter (el, strings) {
    let timer = null
    let stopped = false
    // 多段配置时拼成一段完整文案，只打一次
    const text = strings.join('\n')

    let cursor = el.parentElement && el.parentElement.querySelector('.typed-cursor')
    if (!cursor) {
      cursor = document.createElement('span')
      cursor.className = 'typed-cursor'
      cursor.setAttribute('aria-hidden', 'true')
      cursor.textContent = '|'
      el.insertAdjacentElement('afterend', cursor)
    }

    const clearChars = () => {
      el.innerHTML = ''
    }

    const appendChar = (ch) => {
      if (ch === '\n') {
        const br = document.createElement('br')
        br.className = 'subtitle-break'
        el.appendChild(br)
        return
      }
      const span = document.createElement('span')
      span.className = 'subtitle-char'
      span.textContent = ch
      el.appendChild(span)
    }

    const typeOnce = () => {
      if (stopped) return
      clearChars()
      let i = 0

      const typeNext = () => {
        if (stopped) return
        if (i < text.length) {
          appendChar(text.charAt(i))
          i += 1
          timer = setTimeout(typeNext, TYPE_SPEED)
          return
        }
        // 打完后隐藏光标并停留
        if (cursor) cursor.style.visibility = 'hidden'
      }

      typeNext()
    }

    timer = setTimeout(typeOnce, START_DELAY)

    return {
      strings: [text],
      destroy () {
        stopped = true
        clearTimeout(timer)
        clearChars()
        if (cursor && cursor.parentElement) cursor.remove()
      }
    }
  }

  function patchTypedJSFn () {
    if (!window.typedJSFn) return false
    if (window.typedJSFn.__charFadePatched) return true

    window.typedJSFn.__charFadePatched = true
    window.typedJSFn.init = function (str) {
      if (window.typed && typeof window.typed.destroy === 'function') {
        window.typed.destroy()
      }
      document.querySelectorAll('#site-subtitle .typed-cursor').forEach(node => node.remove())

      const el = document.getElementById('subtitle')
      if (!el) return

      const strings = normalizeStrings(str)
      if (!strings.length) return

      window.typed = createFadingTypewriter(el, strings)
    }

    return true
  }

  function elHasFadeChars () {
    const el = document.getElementById('subtitle')
    return !!(el && el.querySelector('.subtitle-char'))
  }

  function restartIfNeeded () {
    if (!patchTypedJSFn()) return

    // 已在跑我们的淡入打字机，避免被定时 boot 反复重启
    if (window.typed && typeof window.typed.destroy === 'function' && elHasFadeChars()) {
      return
    }

    if (window.typed && Array.isArray(window.typed.strings) && window.typed.strings.length) {
      const strings = normalizeStrings(window.typed.strings)
      if (typeof window.typed.destroy === 'function') window.typed.destroy()
      document.querySelectorAll('#site-subtitle .typed-cursor').forEach(node => node.remove())
      window.typedJSFn.init(strings)
      return
    }

    const el = document.getElementById('subtitle')
    if (!el || window.typed) return
    const current = (el.textContent || '').replace(/\r\n/g, '\n').trim()
    if (!current) return
    window.typedJSFn.init([current])
  }

  const boot = () => restartIfNeeded()
  boot()
  setTimeout(boot, 0)
  setTimeout(boot, 500)

  document.addEventListener('pjax:complete', boot)
  if (window.btf && typeof btf.addGlobalFn === 'function') {
    btf.addGlobalFn('pjaxComplete', boot, 'subtitleCharFade')
  }
})()
