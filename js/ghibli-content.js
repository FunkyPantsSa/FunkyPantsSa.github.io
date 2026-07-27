/**
 * 线绘宫崎骏风：头图波浪 + 内容区光晕漂浮 + 光标柔光 + 视口淡入
 * 兼容 Butterfly pjax（pjax:complete / pjax:success）
 */
(function () {
  const ORB_TYPES = ['sun', 'sky', 'leaf', 'rose']
  const ORB_COUNT = 5
  const WAVE_SVG =
    '<svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path class="wave-back" d="M0,38 C120,78 260,12 420,48 C580,84 700,18 860,52 C1020,86 1180,28 1320,58 C1380,70 1415,48 1440,55 L1440,120 L0,120 Z"></path>' +
    '<path class="wave-mid" d="M0,58 C150,28 310,88 470,55 C630,22 790,78 950,48 C1110,18 1260,72 1440,52 L1440,120 L0,120 Z"></path>' +
    '<path class="wave-front" d="M0,78 C140,102 280,62 440,82 C600,102 760,58 920,80 C1080,102 1240,68 1440,88 L1440,120 L0,120 Z"></path>' +
    '</svg>'

  let cursorGlow = null
  let rafId = 0
  let pointerX = 0
  let pointerY = 0
  let glowX = 0
  let glowY = 0
  let observer = null
  let contentBound = false

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 768px)').matches

  function ensureCursorGlow () {
    if (cursorGlow || reduceMotion() || isMobile()) return
    cursorGlow = document.createElement('div')
    cursorGlow.className = 'ghibli-cursor-glow'
    cursorGlow.setAttribute('aria-hidden', 'true')
    document.body.appendChild(cursorGlow)
  }

  function ensureHeroWave () {
    const header = document.getElementById('page-header')
    if (!header) return

    const existing = header.querySelector('.ghibli-hero-wave')
    if (!header.classList.contains('full_page')) {
      if (existing) existing.remove()
      return
    }

    if (existing) return

    const wave = document.createElement('div')
    wave.className = 'ghibli-hero-wave'
    wave.setAttribute('aria-hidden', 'true')
    wave.innerHTML = WAVE_SVG
    header.appendChild(wave)
  }

  function clearGlowLayer (root) {
    const old = root.querySelector(':scope > .ghibli-glow-layer')
    if (old) old.remove()
  }

  function spawnOrbs (root) {
    if (reduceMotion()) return
    clearGlowLayer(root)

    const layer = document.createElement('div')
    layer.className = 'ghibli-glow-layer'
    layer.setAttribute('aria-hidden', 'true')

    for (let i = 0; i < ORB_COUNT; i++) {
      const orb = document.createElement('div')
      const type = ORB_TYPES[i % ORB_TYPES.length]
      const size = 140 + Math.random() * 160
      orb.className = 'ghibli-glow-orb ghibli-glow-orb--' + type
      orb.style.width = size + 'px'
      orb.style.height = size * (0.75 + Math.random() * 0.35) + 'px'
      orb.style.left = Math.random() * 88 + '%'
      orb.style.top = Math.random() * 85 + '%'
      orb.style.setProperty('--orb-dur', 12 + Math.random() * 14 + 's')
      orb.style.setProperty('--orb-delay', -Math.random() * 10 + 's')
      orb.style.setProperty('--orb-tx', (Math.random() * 56 - 28) + 'px')
      orb.style.setProperty('--orb-ty', (Math.random() * 50 - 25) + 'px')
      layer.appendChild(orb)
    }

    // 必须插到末尾，不能当 .layout 的首个子元素：
    // Butterfly 会对 .layout > div:first-child:not(.nc) 套白色卡片样式
    layer.classList.add('nc')
    root.appendChild(layer)
  }

  function observeReveals () {
    if (observer) {
      observer.disconnect()
      observer = null
    }

    const nodes = document.querySelectorAll(
      '.recent-post-item, #aside-content .card-widget, #post #article-container'
    )
    if (!nodes.length) return

    if (reduceMotion() || !('IntersectionObserver' in window)) {
      nodes.forEach(function (el) {
        el.classList.add('ghibli-reveal')
      })
      return
    }

    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return
          entry.target.classList.add('ghibli-reveal')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )

    nodes.forEach(function (el, index) {
      // 左右栏首项同步出现，避免顶部错位感
      const isColumnTop =
        el.matches('#aside-content > .card-widget:first-child') ||
        el.matches('#recent-posts .recent-post-items > .recent-post-item:first-child') ||
        el.matches('#recent-posts > .recent-post-item:first-child')
      el.style.animationDelay = isColumnTop ? '0s' : Math.min(index * 0.07, 0.42) + 's'
      observer.observe(el)
    })
  }

  function onPointerMove (e) {
    pointerX = e.clientX
    pointerY = e.clientY
    if (cursorGlow) cursorGlow.classList.add('is-active')
  }

  function onPointerLeave () {
    if (cursorGlow) cursorGlow.classList.remove('is-active')
  }

  function tickGlow () {
    if (!cursorGlow) return
    glowX += (pointerX - glowX) * 0.12
    glowY += (pointerY - glowY) * 0.12
    cursorGlow.style.transform = 'translate(' + glowX + 'px, ' + glowY + 'px)'
    rafId = window.requestAnimationFrame(tickGlow)
  }

  function bindPointer () {
    if (contentBound || reduceMotion() || isMobile()) return
    ensureCursorGlow()
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave, { passive: true })
    rafId = window.requestAnimationFrame(tickGlow)
    contentBound = true
  }

  function setAsideAuthorTitle () {
    const name = document.querySelector('#aside-content .card-info .author-info-name')
    if (name) name.textContent = 'Volin的网络日志'
  }

  function enhance () {
    ensureHeroWave()
    setAsideAuthorTitle()
    const root = document.getElementById('content-inner') || document.querySelector('.layout')
    if (root) spawnOrbs(root)
    observeReveals()
    bindPointer()
  }

  function boot () {
    enhance()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  document.addEventListener('pjax:complete', enhance)
  document.addEventListener('pjax:success', enhance)
})()
