/**
 * 不蒜子访问统计：只在正式域名计数，兼容 Butterfly 的 data-pjax 重执行。
 * 预览、离线与超时显示占位，避免旧页面的迟到响应覆盖当前阅读量。
 */
(function () {
  'use strict'

  const STATE_KEY = '__volinVisitCounter'
  const PJAX_KEY = '__volinVisitCounterPjaxBound'
  const ENDPOINT = 'https://busuanzi.ibruce.info/busuanzi?jsonpCallback='
  const REQUEST_TIMEOUT = 7000
  const PLACEHOLDER = '—'
  const FIELDS = ['site_uv', 'site_pv', 'page_pv']
  const ALLOWED_HOSTS = new Set(['volin.top', 'www.volin.top'])

  const currentPath = () => window.location.pathname

  const isAllowedPage = () => {
    const protocol = window.location.protocol
    return (protocol === 'http:' || protocol === 'https:') &&
      ALLOWED_HOSTS.has(window.location.hostname.toLowerCase().replace(/\.$/, ''))
  }

  const getElements = () => FIELDS.reduce((result, field) => {
    result[field] = document.getElementById('busuanzi_value_' + field)
    return result
  }, {})

  const writePlaceholders = () => {
    const elements = getElements()
    FIELDS.forEach(field => {
      if (elements[field]) elements[field].textContent = PLACEHOLDER
    })
  }

  const normalizeCount = value => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) {
      return PLACEHOLDER
    }
    const count = Number(value)
    return Number.isSafeInteger(count) && count >= 0
      ? String(count)
      : PLACEHOLDER
  }

  const writeCounts = data => {
    const elements = getElements()
    FIELDS.forEach(field => {
      if (elements[field]) elements[field].textContent = normalizeCount(data && data[field])
    })
  }

  if (window[STATE_KEY] && typeof window[STATE_KEY].cancel === 'function') {
    window[STATE_KEY].cancel()
  }

  const state = {
    path: currentPath(),
    callbackName: '__volinVisitCounter_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    script: null,
    timer: null,
    settled: false,
    cleanup () {
      if (state.timer) window.clearTimeout(state.timer)
      if (state.script && state.script.parentNode) state.script.parentNode.removeChild(state.script)
      delete window[state.callbackName]
    },
    cancel () {
      if (state.settled) return
      state.settled = true
      state.cleanup()
      if (window[STATE_KEY] === state) {
        writePlaceholders()
        window[STATE_KEY] = null
      }
    }
  }

  window[STATE_KEY] = state
  writePlaceholders()

  if (!isAllowedPage() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    state.settled = true
    state.cleanup()
    window[STATE_KEY] = null
    return
  }

  if (!window[PJAX_KEY]) {
    document.addEventListener('pjax:send', () => {
      if (window[STATE_KEY] && typeof window[STATE_KEY].cancel === 'function') {
        window[STATE_KEY].cancel()
      }
    })
    window[PJAX_KEY] = true
  }

  window[state.callbackName] = data => {
    if (state.settled || window[STATE_KEY] !== state) return
    if (state.path !== currentPath()) {
      state.cancel()
      return
    }
    state.settled = true
    state.cleanup()
    writeCounts(data)
    window[STATE_KEY] = null
  }

  state.script = document.createElement('script')
  state.script.async = true
  // 原接口依靠 Referer 区分文章，须与官方脚本采用相同策略。
  state.script.referrerPolicy = 'no-referrer-when-downgrade'
  state.script.src = ENDPOINT + encodeURIComponent(state.callbackName)
  state.script.onerror = () => state.cancel()
  state.timer = window.setTimeout(() => state.cancel(), REQUEST_TIMEOUT)
  document.head.appendChild(state.script)
})()
