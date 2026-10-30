const editors = [
  ['vscode', 'VS Code'],
  ['vscode-insiders', 'VS Code Insiders'],
  ['cursor', 'Cursor'],
  ['trae', 'TRAE'],
  ['trae-cn', 'TRAE CN（国内版）'],
  ['idea', 'IntelliJ IDEA'],
]

export function createPanel({ onToggle, onClose, onEditorChange }) {
  const element = document.createElement('div')
  element.setAttribute('data-code-provenance-ignore', '')
  Object.assign(element.style, {
    position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
  })
  const shadow = element.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    :host { color-scheme: light; }
    section { box-sizing: border-box; width: 330px; max-width: calc(100vw - 32px);
      padding: 14px; background: #111827; color: #f9fafb; border: 1px solid #64748b;
      border-radius: 10px; font: 13px/1.5 system-ui, sans-serif;
      box-shadow: 0 8px 28px #0006; }
    strong { display: block; margin-bottom: 8px; }
    label { display: block; margin-bottom: 10px; }
    select { max-width: 220px; margin-left: 8px; padding: 4px;
      background: #1e293b; color: white; border: 1px solid #64748b; border-radius: 5px; }
    p { margin: 8px 0 0; overflow-wrap: anywhere; }
    button, a { display: inline-block; box-sizing: border-box; cursor: pointer;
      font: inherit; border: 1px solid #64748b; border-radius: 5px;
      background: #1e293b; color: white; padding: 5px 9px; margin-right: 6px;
      text-decoration: none; }
    button:first-child { background: #2563eb; border-color: #60a5fa; }
    button:hover, a:hover { outline: 2px solid #93c5fd; }
  `
  const section = document.createElement('section')
  section.setAttribute('aria-label', '源码定位工具')
  const title = document.createElement('strong')
  title.textContent = '源码定位 · 已加载'
  const editorLabel = document.createElement('label')
  editorLabel.textContent = '编辑器'
  const editorSelect = document.createElement('select')
  editorSelect.setAttribute('aria-label', '打开源码的编辑器')
  for (const [value, label] of editors) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    editorSelect.appendChild(option)
  }
  editorSelect.addEventListener('change', (event) => {
    event.stopPropagation()
    onEditorChange(editorSelect.value)
  })
  editorLabel.appendChild(editorSelect)
  const toggle = document.createElement('button')
  toggle.textContent = '开始选择'
  toggle.addEventListener('click', (event) => { event.stopPropagation(); onToggle() })
  const testEditor = document.createElement('a')
  testEditor.addEventListener('click', (event) => {
    event.stopPropagation()
    if (!testEditor.hasAttribute('href')) {
      event.preventDefault()
      message.textContent = '请先配置 projectRoot 或 projectName，再测试 IDEA。'
    }
  })
  const close = document.createElement('button')
  close.textContent = '退出'
  close.addEventListener('click', (event) => { event.stopPropagation(); onClose() })
  const message = document.createElement('p')
  message.setAttribute('role', 'status')
  message.textContent = '点击“开始选择”，再移动鼠标并点击页面元素；也可按住 Alt。'
  section.append(title, editorLabel, toggle, testEditor, close, message)
  shadow.append(style, section)

  return {
    element,
    setActive(active) {
      toggle.textContent = active ? '结束选择' : '开始选择'
      toggle.setAttribute('aria-pressed', String(active))
    },
    setEditor({ editor, projectRoot, projectName }) {
      if (!Array.from(editorSelect.options).some((option) => option.value === editor)) {
        const option = document.createElement('option')
        option.value = editor
        option.textContent = editor
        editorSelect.appendChild(option)
      }
      editorSelect.value = editor
      const label = editors.find(([value]) => value === editor)?.[1] || editor
      testEditor.textContent = `测试 ${label}`
      if (editor === 'idea') {
        const project = projectName || projectRoot?.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop()
        if (project) {
          testEditor.href = `jetbrains://idea/navigate/reference?${new URLSearchParams({ project })}`
          testEditor.removeAttribute('aria-disabled')
        } else {
          testEditor.removeAttribute('href')
          testEditor.setAttribute('aria-disabled', 'true')
        }
      } else {
        testEditor.href = `${editor}://settings/editor.wordWrap`
        testEditor.removeAttribute('aria-disabled')
      }
    },
    setMessage(text) { message.textContent = text },
  }
}
