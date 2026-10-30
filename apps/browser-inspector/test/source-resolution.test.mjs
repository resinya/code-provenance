import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceResolver, parseStack } from '../../../packages/code-provenance/dist/resolveSources.js'
import { openSource } from '../../../packages/code-provenance/dist/openSource.js'

function setup(t, fetch) {
  const original = { window: globalThis.window, fetch: globalThis.fetch }
  globalThis.window = { next: { version: '16.2.6' }, location: { origin: 'http://localhost' } }
  globalThis.fetch = fetch
  t.after(() => { globalThis.window = original.window; globalThis.fetch = original.fetch })
}

test('Turbopack HTTP chunks use indexed source maps, not generated file positions', async (t) => {
  setup(t, async (url) => {
    if (url === 'http://localhost/_next/static/chunks/client.js.map') return {
      ok: true, json: async () => ({ version: 3, sections: [{
        offset: { line: 10, column: 0 },
        map: { version: 3, names: [], sources: ['file:///D:/demo/app/ClientCard.jsx'], mappings: 'AAWI' },
      }] }),
    }
    return { ok: true, status: 200, json: async () => [{ status: 'rejected', reason: "Unknown url scheme 'http'" }] }
  })
  const instance = { tag: 5, _debugStack: { stack: 'Error\n    at ClientCard (http://localhost/_next/static/chunks/client.js:11:1)' } }
  const result = await createSourceResolver()([instance])
  assert.equal(result[0]?.source.fileName, 'D:/demo/app/ClientCard.jsx')
  assert.equal(result[0]?.source.lineNumber, 12)
  assert.equal(result[0]?.source.columnNumber, 5)
})

test('stack parsing preserves Windows paths, URL ports and Firefox frames', () => {
  const frames = parseStack('Error\n    at Card (D:\\demo\\Card.jsx:12:5)\nCard@http://localhost:3000/main.js:20:8')
  assert.deepEqual(frames.map(({ file, line1, column1 }) => ({ file, line1, column1 })), [
    { file: 'D:\\demo\\Card.jsx', line1: 12, column1: 5 },
    { file: 'http://localhost:3000/main.js', line1: 20, column1: 8 },
  ])
})

test('legacy source metadata bypasses network requests', async (t) => {
  setup(t, () => { throw new Error('Legacy inspection must not fetch') })
  const instance = { _debugSource: { fileName: 'D:/demo/App.jsx', lineNumber: 3, columnNumber: 2 } }
  const result = await createSourceResolver()([instance])
  assert.deepEqual(result[0].source, instance._debugSource)
})

test('Next server owners preserve server context and apply projectRoot to relative sources', async (t) => {
  const requests = []
  setup(t, async (_, options) => {
    const body = JSON.parse(options.body)
    requests.push(body)
    return { ok: true, status: 200, json: async () => body.frames.map(() => ({
      status: 'fulfilled', value: { originalStackFrame: { file: 'app\\page.jsx', line1: 5, column1: 8 } },
    })) }
  })
  const instance = { name: 'Page', env: 'Server', stack: [['Page', 'file:///D:/demo/.next/server/page.js', 30, 4]] }
  const result = await createSourceResolver({ projectRoot: 'D:/demo' })([instance])
  assert.equal(requests[0].isServer, true)
  assert.deepEqual(result[0].source, { fileName: 'D:/demo/app/page.jsx', lineNumber: 5, columnNumber: 8, openWithNext: true })
})

test('unavailable or invalid HTTP maps never return generated chunk positions', async (t) => {
  setup(t, async () => ({ ok: false, status: 404 }))
  const instance = { tag: 5, _debugStack: { stack: 'Error\n at Card (http://localhost/_next/static/chunks/card.js:20:9)' } }
  assert.deepEqual(await createSourceResolver()([instance]), [])
})

test('Next API failures and incompatible responses remain actionable errors', async (t) => {
  const instance = { tag: 5, _debugStack: { stack: 'Error\n at Card (webpack-internal:///card.jsx:20:9)' } }
  setup(t, async () => ({ ok: false, status: 404 }))
  await assert.rejects(createSourceResolver()([instance]), /HTTP 404.*next dev/)
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ error: 'changed API' }) })
  await assert.rejects(createSourceResolver()([instance]), /响应格式不兼容/)
})

test('in-flight maps are shared, but subsequent selections refresh locations after HMR', async (t) => {
  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  setup(t, async (_, options) => {
    const version = ++calls
    await gate
    const body = JSON.parse(options.body)
    return { ok: true, status: 200, json: async () => body.frames.map(() => ({
      status: 'fulfilled', value: { originalStackFrame: { file: 'app/Card.jsx', line1: version, column1: 1 } },
    })) }
  })
  const instance = { tag: 5, _debugStack: { stack: 'Error\n at Card (webpack-internal:///card.jsx:20:9)' } }
  const resolve = createSourceResolver()
  const first = resolve([instance])
  const second = resolve([instance])
  await new Promise((r) => setImmediate(r))
  assert.equal(calls, 1)
  release()
  assert.equal((await first)[0].source.lineNumber, 1)
  assert.equal((await second)[0].source.lineNumber, 1)
  assert.equal((await resolve([instance]))[0].source.lineNumber, 2)
})

test('relative Next sources launch via Next, while absolute paths respect the chosen editor', async (t) => {
  const requests = []
  const editorUrls = []
  setup(t, async (url) => { requests.push(url); return { ok: true } })
  globalThis.window.location.assign = (url) => editorUrls.push(url)
  const source = { fileName: 'app/page.jsx', lineNumber: 5, columnNumber: 8, openWithNext: true }
  await openSource(source, { editor: 'cursor' })
  const url = new URL(requests[0], 'http://localhost')
  assert.equal(url.pathname, '/__nextjs_launch-editor')
  assert.equal(url.searchParams.get('file'), 'app/page.jsx')
  assert.equal(url.searchParams.get('line1'), '5')
  assert.equal(url.searchParams.get('column1'), '8')
  await openSource(source, { editor: 'cursor', pathModifier: (path) => 'D:/demo/' + path })
  assert.deepEqual(editorUrls, ['cursor://file/D:/demo/app/page.jsx:5:8'])
  assert.equal(requests.length, 1)
})
