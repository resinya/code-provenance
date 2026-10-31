import { CodeProvenance } from '@resinya/code-provenance'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { createPanel } from './panel.js'

const name = 'code-provenance/browser-inspector'
const version = 5
const hostId = 'code-provenance-browser-inspector'
const targetAttribute = 'data-code-provenance-target'
const bodyAttribute = 'data-code-provenance'

function createInspector() {
  let root
  let host
  let options = { editor: 'vscode' }
  let restoreIndicators
  let selecting = false
  let panel

  function render() {
    flushSync(() => {
      root.render(
        createElement(CodeProvenance, {
          ...options,
          portalId: `${hostId}-portal`,
          active: selecting,
          onStatus: (message) => panel.setMessage(message),
        }),
      )
    })
    panel.setActive(selecting)
    panel.setEditor(options)
  }

  const api = {
    name,
    version,
    get mounted() {
      return Boolean(root)
    },
    get selecting() {
      return selecting
    },
    select() {
      if (!root) api.mount()
      selecting = true
      render()
      panel.setMessage(
        '选择中：移动到页面元素，单击打开源码，右键选择上层组件。',
      )
      return api
    },
    pause() {
      selecting = false
      if (root) {
        render()
        panel.setMessage('已结束选择。可再次点击“开始选择”或按住 Alt。')
      }
      return api
    },
    mount(nextOptions = {}) {
      if (!nextOptions || typeof nextOptions !== 'object') {
        throw new TypeError('Inspector options must be an object')
      }

      const {
        editor = options.editor,
        pathModifier = options.pathModifier,
        projectRoot = options.projectRoot,
        projectName = options.projectName,
      } = nextOptions

      if (typeof editor !== 'string' || !/^[a-z][a-z\d+.-]*$/i.test(editor)) {
        throw new TypeError('editor must be an editor URL scheme, e.g. vscode')
      }
      if (pathModifier !== undefined && typeof pathModifier !== 'function') {
        throw new TypeError('pathModifier must be a function')
      }
      if (
        projectRoot !== undefined &&
        (typeof projectRoot !== 'string' ||
          !/^(?:[a-z]:[\\/]|\/|\\\\)/i.test(projectRoot))
      ) {
        throw new TypeError(
          'projectRoot must be an absolute local project path',
        )
      }
      if (
        projectName !== undefined &&
        (typeof projectName !== 'string' || !projectName.trim())
      ) {
        throw new TypeError('projectName must be a non-empty IDEA project name')
      }
      if (!document.body) {
        throw new Error('Wait for document.body before mounting the inspector')
      }

      document.removeEventListener('DOMContentLoaded', autoMount)
      options = { editor, pathModifier, projectRoot, projectName }

      if (!root) {
        if (document.getElementById(hostId)) {
          throw new Error(`An unrelated element already uses #${hostId}`)
        }

        const body = document.body
        const previousBodyState = body.getAttribute(bodyAttribute)
        const previousTargets = Array.from(
          document.querySelectorAll(`[${targetAttribute}]`),
          (element) => [element, element.getAttribute(targetAttribute)],
        )
        restoreIndicators = () => {
          document
            .querySelectorAll(`[${targetAttribute}]`)
            .forEach((element) => {
              element.removeAttribute(targetAttribute)
            })
          previousTargets.forEach(([element, value]) => {
            if (element.isConnected)
              element.setAttribute(targetAttribute, value)
          })
          if (previousBodyState === null) body.removeAttribute(bodyAttribute)
          else body.setAttribute(bodyAttribute, previousBodyState)
        }

        host = document.createElement('div')
        host.id = hostId
        host.setAttribute('data-code-provenance-ignore', '')
        const mountPoint = document.createElement('div')
        const portal = document.createElement('div')
        portal.id = `${hostId}-portal`
        panel = createPanel({
          onToggle: () => (selecting ? api.pause() : api.select()),
          onClose: () => api.unmount(),
          onEditorChange: (editor) => {
            api.mount({ editor })
            panel.setMessage(
              editor === 'idea'
                ? '已切换到 IDEA。请确保已安装 JetBrains Toolbox，并配置本机 projectRoot。'
                : '已切换编辑器，下一次选择源码时生效。',
            )
          },
        })
        host.append(mountPoint, portal, panel.element)
        body.appendChild(host)
        root = createRoot(mountPoint)
      }

      try {
        render()
      } catch (error) {
        api.unmount()
        throw error
      }

      return api
    },
    unmount() {
      document.removeEventListener('DOMContentLoaded', autoMount)
      if (root) {
        root.unmount()
        root = undefined
        selecting = false
        host.remove()
        host = undefined
        panel = undefined
        restoreIndicators()
        restoreIndicators = undefined
      }
      return api
    },
  }

  return api
}

function autoMount() {
  window.__CP__.mount(window.__CP_OPTIONS__)
}

if (window.__CP__ && window.__CP__.name !== name) {
  throw new Error('window.__CP__ is already in use by another tool')
}

if (window.__CP__ && window.__CP__.version !== version) {
  window.__CP__.unmount()
  delete window.__CP__
}

const existingInspector = window.__CP__
window.__CP__ ??= createInspector()

if (document.body) {
  autoMount()
} else if (!existingInspector) {
  document.addEventListener('DOMContentLoaded', autoMount, { once: true })
}
