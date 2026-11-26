/**
 * Vercount 访问统计：显式提交页面地址，兼容 Butterfly 的 data-pjax 重执行。
 * 仅正式域名计数；预览、离线与异常显示占位，迟到响应不会覆盖新页面。
 */
(function () {
  'use strict'

  const STATE_KEY = '__volinVisitCounter'
  const PJAX_KEY = '__volinVisitCounterPjaxBound'
  const UV_KEY = '__volinVisitCounterUvSeen'
  const UV_COOKIE = 'vercount_uv_www_volin_top'
  const ENDPOINT = 'https://events.vercount.one/api/v2/log'
  const CANONICAL_ORIGIN = 'https://www.volin.top'
  const REQUEST_TIMEOUT = 7000
  const FIELDS = ['site_uv', 'site_pv', 'page_pv']
  const ALLOWED_HOSTS = new Set(['volin.top', 'www.volin.top'])

  const currentPath = () => {
    const path = window.location.pathname || '/'
    return path.replace(/\/index\.html$/i, '/')
  }

  const isAllowedPage = () => {
    const protocol = window.location.protocol
    return (protocol === 'http:' || protocol === 'https:') &&
      ALLOWED_HOSTS.has(window.location.hostname.toLowerCase().replace(/\.$/, ''))
  }

  const display = (data, title) => {
    FIELDS.forEach(field => {
      const element = document.getElementById('busuanzi_value_' + field)
      if (element) {
        element.textContent = data ? String(data[field]) : '—'
        element.title = title
      }
    })
  }

  const validData = response => response && response.status === 'success' &&
    response.data && FIELDS.every(field =>
    Number.isSafeInteger(response.data[field]) && response.data[field] >= 0)

  if (window[STATE_KEY] && typeof window[STATE_KEY].cancel === 'function') {
    window[STATE_KEY].cancel()
  }

  if (!isAllowedPage()) {
    display(null, '本地或预览页面不计入访问统计')
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    display(null, '当前离线，访问统计暂不可用')
    return
  }
  if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function') {
    display(null, '当前浏览器不支持访问统计请求')
    return
  }

  const uvState = window[UV_KEY] && typeof window[UV_KEY] === 'object'
    ? window[UV_KEY]
    : { confirmed: false, pending: null }
  window[UV_KEY] = uvState

  const state = {
    path: currentPath(),
    controller: new window.AbortController(),
    timer: null,
    settled: false,
    isCurrent () {
      return window[STATE_KEY] === state && state.path === currentPath()
    },
    finish (data, title) {
      if (state.settled) return
      state.settled = true
      window.clearTimeout(state.timer)
      if (uvState.pending === state) {
        uvState.pending = null
        if (data) {
          uvState.confirmed = true
          try {
            document.cookie = UV_COOKIE + '=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure; Domain=volin.top'
          } catch (error) {
            // Cookie 不可用时，成功记录的 UV 仍在当前标签页内去重。
          }
        }
      }
      if (state.isCurrent()) display(data, title)
      if (window[STATE_KEY] === state) window[STATE_KEY] = null
    },
    cancel (title) {
      state.finish(null, title || '页面已切换，访问统计已取消')
      state.controller.abort()
    }
  }

  window[STATE_KEY] = state
  display(null, '正在加载访问统计')

  if (!window[PJAX_KEY]) {
    document.addEventListener('pjax:send', () => {
      if (window[STATE_KEY] && typeof window[STATE_KEY].cancel === 'function') {
        window[STATE_KEY].cancel()
      }
    })
    window[PJAX_KEY] = true
  }

  let hasUvCookie = false
  try {
    hasUvCookie = document.cookie.split(';').some(part => part.trim() === UV_COOKIE + '=1')
  } catch (error) {
    // Cookie 不可用时，仍在当前标签页内去重。
  }
  if (hasUvCookie) uvState.confirmed = true
  const isNewUv = !uvState.confirmed && !uvState.pending
  // pending 只属于本次请求；失败或取消会释放，成功后才写一年 Cookie。
  if (isNewUv) uvState.pending = state

  state.timer = window.setTimeout(() => {
    state.cancel('访问统计请求超时，请稍后再试')
  }, REQUEST_TIMEOUT)

  ;(async () => {
    try {
      const response = await window.fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: JSON.stringify({ url: CANONICAL_ORIGIN + state.path, isNewUv }),
        signal: state.controller.signal
      })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const data = await response.json()
      if (!validData(data)) throw new Error('Invalid counter response')
      state.finish(data.data, '访问统计由 Vercount 提供')
    } catch (error) {
      state.finish(null, '访问统计服务暂不可用')
    }
  })()
})()
