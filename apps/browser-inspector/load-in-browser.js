// 在 DevTools > Sources > Snippets 中粘贴运行，即可对当前页面进行源码定位检查。
// 可选配置：window.__CP_OPTIONS__ = { editor: 'cursor', projectRoot: 'D:/my-project' }
// editor 支持 vscode / vscode-insiders / cursor / trae / trae-cn / idea。
;(() => {
  const id = 'code-provenance-inspector-loader'
  if (document.getElementById(id)) return

  const script = document.createElement('script')
  const notice = document.createElement('div')
  notice.textContent = '正在加载源码定位工具…'
  Object.assign(notice.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '2147483647',
    padding: '12px',
    background: '#111827',
    color: '#ffffff',
    font: '14px system-ui',
  })
  document.body.appendChild(notice)
  script.id = id
  script.src = 'http://127.0.0.1:4179/inspector.js?t=' + Date.now()
  script.onload = () => {
    script.remove()
    if (
      window.__CP__?.name === 'code-provenance/browser-inspector' &&
      window.__CP__.mounted
    )
      notice.remove()
    else
      notice.textContent = '脚本已加载，但工具启动失败。请查看控制台红色错误。'
  }
  script.onerror = () => {
    script.remove()
    notice.textContent =
      '源码定位工具加载失败：请检查本地 4179 服务和控制台错误。'
    console.error(
      '[code-provenance] 检查工具加载失败：请检查本地服务与浏览器控制台；' +
        '也可以直接把 dist/inspector.js 粘贴到 DevTools Snippet 中运行。',
    )
  }
  document.head.appendChild(script)
})()
