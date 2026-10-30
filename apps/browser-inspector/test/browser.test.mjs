import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import test from 'node:test'
import { build } from 'esbuild'
import { JSDOM, VirtualConsole } from 'jsdom'
import { buildInspector } from '../build.mjs'

const require = createRequire(import.meta.url)
const requireReact16 = createRequire(new URL('../fixtures/react16/package.json', import.meta.url))
const requireReact19 = createRequire(new URL('../fixtures/next16/package.json', import.meta.url))
const bundle = await readFile(await buildInspector(), 'utf8')
const hostId = 'code-provenance-browser-inspector'
const tick = () => new Promise((resolve) => setTimeout(resolve, 20))

async function createPage(version, { withSource = true, beforeInspect } = {}) {
  const legacy = version === 16
  const fixtureRequire = version === 19 ? requireReact19 : legacy ? requireReact16 : require
  const fixture = await build({
    stdin: {
      contents: `
        import React from 'react';
        ${version === 19 ? "import { jsxDEV } from 'react/jsx-dev-runtime';" : ''}
        import { ${legacy ? 'render' : 'flushSync'} } from 'react-dom';
        ${legacy ? '' : "import { createRoot } from 'react-dom/client';"}
        function Fixture() {
          return ${version === 19 ? 'jsxDEV' : 'React.createElement'}('button', {
            id: 'target',
            __source: ${withSource ? "{ fileName: 'D:/demo/src/Fixture.jsx', lineNumber: 12, columnNumber: 5 }" : 'undefined'}
            ${version === 19 ? ", children: 'Target component'" : ''}
          }, ${version === 19 ? "undefined, false, { fileName: 'D:/demo/src/Fixture.jsx', lineNumber: 12, columnNumber: 5 }, this" : "'Target component'"});
        }
        const container = document.getElementById('app');
        ${legacy ? 'render(React.createElement(Fixture), container);' : 'flushSync(() => createRoot(container).render(React.createElement(Fixture)));'}
      `,
      resolveDir: dirname(require.resolve('react/package.json')),
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"development"' },
    alias: {
      react: dirname(fixtureRequire.resolve('react/package.json')),
      'react-dom': dirname(fixtureRequire.resolve('react-dom/package.json')),
    },
  })

  const errors = []
  const console = new VirtualConsole()
  console.on('jsdomError', (error) => errors.push(error.message))
  console.on('error', (...args) => errors.push(args.join(' ')))
  const dom = new JSDOM(
    '<!doctype html><div id="app"></div>' +
      '<div id="floating-ui-root"><span id="existing-portal">Existing UI</span></div>',
    {
      url: 'http://localhost/',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      virtualConsole: console,
    }
  )
  // JSDOM 没有布局/滚动能力；FloatingOverlay 关闭时会恢复滚动。
  dom.window.scrollTo = () => {}
  dom.window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  dom.window.eval(fixture.outputFiles[0].text + '\n//# sourceURL=webpack-internal:///fixture.js')
  beforeInspect?.(dom.window)
  dom.window.eval(bundle)
  await tick()

  return { dom, window: dom.window, errors }
}

async function hover(window) {
  const target = window.document.getElementById('target')
  target.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
  await tick()
  window.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Alt', altKey: true })
  )
  await tick()
  return target
}

for (const version of [16, 18]) {
  test(`standalone inspector can inspect a separate React ${version} root and clean up`, async (t) => {
    const { dom, window, errors } = await createPage(version)
    t.after(() => {
      window.__CP__.unmount()
      dom.window.close()
    })
    const api = window.__CP__
    assert.equal(api.mounted, true)
    const target = await hover(window)
    assert.equal(target.getAttribute('data-code-provenance-target'), 'HOVER')

    target.dispatchEvent(
      new window.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        altKey: true,
        button: 2,
      })
    )
    await tick()
    const item = window.document.querySelector('[role="menuitem"]')
    assert.ok(item, 'right-click menu contains the target component')
    assert.equal(item.value, 'D:/demo/src/Fixture.jsx:12:5')
    assert.ok(window.document.getElementById(hostId).contains(item))

    api.unmount()
    assert.equal(api.mounted, false)
    assert.equal(window.document.getElementById(hostId), null)
    assert.equal(window.document.body.hasAttribute('data-code-provenance'), false)
    assert.equal(window.document.querySelector('[data-code-provenance-target]'), null)
    assert.ok(window.document.getElementById('existing-portal'))
    assert.ok(window.document.getElementById('target'), 'host application remains mounted')
    await hover(window)
    assert.equal(window.document.querySelector('[data-code-provenance-target]'), null)
    assert.deepEqual(errors, [])
  })
}

test('reloading reuses one inspector and remounting applies pathModifier', async (t) => {
  const { dom, window, errors } = await createPage(18)
  t.after(() => {
    window.__CP__.unmount()
    dom.window.close()
  })
  const api = window.__CP__
  window.eval(bundle)
  assert.equal(window.__CP__, api)
  assert.equal(window.document.querySelectorAll(`#${hostId}`).length, 1)

  api.unmount().unmount()
  api.mount({ editor: 'cursor', pathModifier: (path) => path.replace('D:/demo', 'E:/local') })
  const target = await hover(window)
  target.dispatchEvent(
    new window.MouseEvent('contextmenu', { bubbles: true, altKey: true, button: 2 })
  )
  await tick()
  assert.equal(
    window.document.querySelector('[role="menuitem"]').value,
    'E:/local/src/Fixture.jsx:12:5'
  )
  assert.throws(() => api.mount({ pathModifier: 'invalid' }), /pathModifier/)
  assert.equal(api.mounted, true)
  assert.deepEqual(errors, [])
})

test('the panel switches editors, updates protocol tests and preserves project configuration', async (t) => {
  const { dom, window, errors } = await createPage(18, {
    beforeInspect(window) {
      window.__CP_OPTIONS__ = { editor: 'trae-cn', projectRoot: 'D:/demo', projectName: 'IDE Project' }
    },
  })
  t.after(() => { window.__CP__.unmount(); dom.window.close() })
  const api = window.__CP__
  const shadow = window.document.getElementById(hostId).lastElementChild.shadowRoot
  const select = shadow.querySelector('select')
  const link = shadow.querySelector('a')
  assert.equal(select.value, 'trae-cn')
  assert.equal(link.protocol, 'trae-cn:')
  assert.deepEqual(Array.from(select.options, (option) => option.value),
    ['vscode', 'vscode-insiders', 'cursor', 'trae', 'trae-cn', 'idea'])

  api.select()
  for (const editor of ['cursor', 'trae', 'idea']) {
    select.value = editor
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
    assert.equal(api.selecting, true)
    assert.equal(select.value, editor)
    assert.equal(link.protocol, editor === 'idea' ? 'jetbrains:' : `${editor}:`)
  }
  assert.equal(new URL(link.href).searchParams.get('project'), 'IDE Project')
  assert.match(link.textContent, /IDEA/)
  api.mount({ editor: 'cursor' })
  assert.equal(select.value, 'cursor')
  assert.match(link.textContent, /Cursor/)
  assert.throws(() => api.mount({ projectName: '' }), /projectName/)
  assert.throws(() => api.mount({ projectName: 123 }), /projectName/)
  assert.deepEqual(errors, [])
})

test('the panel explains IDEA configuration before testing its protocol', async (t) => {
  const { dom, window, errors } = await createPage(18, {
    beforeInspect(window) { window.__CP_OPTIONS__ = { editor: 'idea' } },
  })
  t.after(() => { window.__CP__.unmount(); dom.window.close() })
  const shadow = window.document.getElementById(hostId).lastElementChild.shadowRoot
  const link = shadow.querySelector('a')
  assert.equal(link.hasAttribute('href'), false)
  link.click()
  assert.match(shadow.querySelector('[role="status"]').textContent, /projectRoot.*projectName/)
  window.__CP__.mount({ projectRoot: 'D:/demo' })
  assert.equal(new URL(link.href).searchParams.get('project'), 'demo')
  assert.equal(link.hasAttribute('aria-disabled'), false)
  assert.deepEqual(errors, [])
})

test('loading before document.body waits for DOMContentLoaded', async () => {
  const dom = new JSDOM('<!doctype html><div>Host page</div>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.eval(bundle)
      assert.equal(window.__CP__.mounted, false)
    },
  })
  try {
    await tick()
    assert.equal(dom.window.__CP__.mounted, true)
  } finally {
    dom.window.__CP__.unmount()
    dom.window.close()
  }
})

test('unmount cancels pending startup even after loading twice before body exists', async () => {
  const dom = new JSDOM('<!doctype html><div>Host page</div>', {
    runScripts: 'outside-only',
    beforeParse(window) {
      window.eval(bundle)
      window.eval(bundle)
      window.__CP__.unmount()
    },
  })
  try {
    await tick()
    assert.equal(dom.window.__CP__.mounted, false)
    assert.equal(dom.window.document.getElementById(hostId), null)
  } finally {
    dom.window.close()
  }
})

test('inspection still works when the host application stops bubbling input events', async (t) => {
  const { dom, window } = await createPage(16)
  t.after(() => {
    window.__CP__.unmount()
    dom.window.close()
  })
  const target = window.document.getElementById('target')
  target.addEventListener('mousemove', (event) => event.stopPropagation())
  target.addEventListener('keydown', (event) => event.stopPropagation())
  target.addEventListener('contextmenu', (event) => event.stopPropagation())
  target.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
  await tick()
  target.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true })
  )
  await tick()
  assert.equal(target.getAttribute('data-code-provenance-target'), 'HOVER')
  target.dispatchEvent(new window.MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, altKey: true, button: 2,
  }))
  await tick()
  assert.equal(window.document.querySelector('[role="menuitem"]').value,
    'D:/demo/src/Fixture.jsx:12:5')
})

test('manual selection works without Alt and explains missing source without activating business clicks', async (t) => {
  const { dom, window } = await createPage(16, { withSource: false })
  t.after(() => {
    window.__CP__.unmount()
    dom.window.close()
  })
  const host = window.document.getElementById(hostId)
  const panel = host.querySelector('[data-code-provenance-ignore]').shadowRoot
  const toggle = panel.querySelector('button')
  const status = panel.querySelector('[role="status"]')
  assert.equal(toggle.textContent, '开始选择')
  toggle.click()
  assert.equal(window.__CP__.selecting, true)
  assert.equal(toggle.textContent, '结束选择')

  const target = window.document.getElementById('target')
  let businessClicks = 0
  target.addEventListener('click', () => businessClicks++)
  target.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
  await tick()
  assert.equal(target.getAttribute('data-code-provenance-target'), 'HOVER')
  target.click()
  assert.match(status.textContent, /没有源码位置信息/)
  assert.match(status.textContent, /button#target/)
  assert.equal(businessClicks, 0)
  toggle.click()
  await tick()
  assert.equal(window.__CP__.selecting, false)
  assert.equal(target.hasAttribute('data-code-provenance-target'), false)
  target.click()
  assert.equal(businessClicks, 1)
})

test('Alt on mousemove activates inspection even when the keydown was missed', async (t) => {
  const { dom, window } = await createPage(18)
  t.after(() => {
    window.__CP__.unmount()
    dom.window.close()
  })
  const target = window.document.getElementById('target')
  target.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, altKey: true }))
  await tick()
  assert.equal(target.getAttribute('data-code-provenance-target'), 'HOVER')
})

test('a new bundle replaces an older entry instead of silently reusing it', async (t) => {
  const { dom, window } = await createPage(18)
  t.after(() => {
    window.__CP__.unmount()
    dom.window.close()
  })
  const original = window.__CP__
  let unmountedOld = false
  window.__CP__ = {
    name: original.name,
    unmount() { unmountedOld = true; original.unmount() },
  }
  window.eval(bundle)
  assert.equal(unmountedOld, true)
  assert.equal(window.__CP__.version, 5)
  assert.equal(window.document.querySelectorAll(`#${hostId}`).length, 1)
})

test('an imperative DOM child can resolve its owning React ancestor', async (t) => {
  const { dom, window } = await createPage(16)
  t.after(() => {
    window.__CP__.unmount()
    dom.window.close()
  })
  const child = window.document.createElement('div')
  child.id = 'mb-ruler'
  window.document.getElementById('target').appendChild(child)
  window.__CP__.select()
  child.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }))
  await tick()
  child.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, button: 2 }))
  await tick()
  const item = window.document.querySelector('[role="menuitem"]')
  assert.ok(item, 'the menu should resolve the React owner of the plain DOM child')
  assert.equal(item.value, 'D:/demo/src/Fixture.jsx:12:5')
})

test('React 19 JSX stacks resolve through Next into the component menu', async (t) => {
  const requests = []
  const { dom, window } = await createPage(19, {
    beforeInspect(window) {
      window.next = { version: '16.2.6' }
      window.__CP_OPTIONS__ = { projectRoot: 'D:/demo' }
      window.fetch = async (url, options) => {
        assert.equal(url, '/__nextjs_original-stack-frames')
        const request = JSON.parse(options.body)
        requests.push(request)
        return {
          ok: true,
          status: 200,
          json: async () => request.frames.map((frame) => frame.methodName === 'Fixture'
            ? { status: 'fulfilled', value: { originalStackFrame: {
              file: 'src/Fixture.jsx', line1: 12, column1: 5, ignored: false,
            } } }
            : { status: 'rejected', reason: 'Not an application frame' }),
        }
      }
    },
  })
  t.after(() => { window.__CP__.unmount(); dom.window.close() })
  const target = window.document.getElementById('target')
  const fiber = target[Object.keys(target).find((key) => key.startsWith('__reactFiber'))]
  assert.equal(fiber._debugSource, undefined, 'fixture uses real React 19 source metadata')
  assert.ok(fiber._debugStack)
  window.__CP__.select()
  target.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  await tick()
  const item = window.document.querySelector('[role="menuitem"]')
  assert.ok(item, 'React 19 component appears after source mapping')
  assert.equal(item.value, 'D:/demo/src/Fixture.jsx:12:5')
  assert.ok(requests.some((request) => request.frames.some((frame) => frame.methodName === 'Fixture')))
})

for (const action of ['pause', 'unmount']) {
  test(`${action} cancels a pending React 19 click before opening an editor`, async (t) => {
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const launches = []
    const { dom, window } = await createPage(19, {
      beforeInspect(window) {
        window.next = { version: '16.2.6' }
        window.fetch = async (url, options) => {
          if (url !== '/__nextjs_original-stack-frames') { launches.push(url); return { ok: true } }
          const body = JSON.parse(options.body)
          await gate
          return { ok: true, status: 200, json: async () => body.frames.map(() => ({
            status: 'fulfilled', value: { originalStackFrame: { file: 'app/Card.jsx', line1: 5, column1: 1 } },
          })) }
        }
      },
    })
    t.after(() => { window.__CP__.unmount(); dom.window.close() })
    window.__CP__.select()
    window.document.getElementById('target').click()
    window.__CP__[action]()
    release()
    await tick()
    assert.deepEqual(launches, [])
    if (action === 'pause') {
      const panel = window.document.getElementById(hostId).querySelector('[data-code-provenance-ignore]').shadowRoot
      assert.match(panel.querySelector('[role="status"]').textContent, /已结束选择/)
    } else assert.equal(window.document.getElementById(hostId), null)
  })
}
