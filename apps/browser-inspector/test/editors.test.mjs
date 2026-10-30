import assert from 'node:assert/strict'
import test from 'node:test'
import { getUrl } from '../../../packages/code-provenance/dist/getUrl.js'
import { openSource } from '../../../packages/code-provenance/dist/openSource.js'

for (const editor of ['vscode', 'vscode-insiders', 'cursor', 'trae', 'trae-cn', 'custom-editor']) {
  test(`${editor} preserves file paths and source coordinates in a file URL`, () => {
    assert.equal(getUrl({ editor, pathToSource: 'D:\\my project\\页面#1?100%.tsx:12:5' }),
      `${editor}://file/D:/my%20project/%E9%A1%B5%E9%9D%A2%231%3F100%25.tsx:12:5`)
    assert.equal(getUrl({ editor, pathToSource: '/home/dev/App.tsx:1:1' }),
      `${editor}://file/home/dev/App.tsx:1:1`)
  })
}

test('IDEA uses a project-relative path and zero-based coordinates with Windows drive letters', () => {
  const url = new URL(getUrl({
    editor: 'idea',
    pathToSource: 'd:\\My Project\\src\\页面#1&2.tsx:12:5',
    projectRoot: 'D:/My Project/',
  }))
  assert.equal(url.protocol, 'jetbrains:')
  assert.equal(url.host, 'idea')
  assert.equal(url.pathname, '/navigate/reference')
  assert.equal(url.searchParams.get('project'), 'My Project')
  assert.equal(url.searchParams.get('path'), 'src/页面#1&2.tsx:11:4')
  assert.equal(url.hash, '')
})

test('IDEA supports POSIX roots, renamed projects, relative paths and the first character', () => {
  const url = new URL(getUrl({
    editor: 'idea', pathToSource: '/home/dev/demo/src/App.tsx:1:1',
    projectRoot: '/home/dev/demo', projectName: 'Renamed & 项目',
  }))
  assert.equal(url.searchParams.get('project'), 'Renamed & 项目')
  assert.equal(url.searchParams.get('path'), 'src/App.tsx:0:0')
  assert.equal(new URL(getUrl({ editor: 'idea', pathToSource: './src/App.tsx:3:2', projectName: 'demo' }))
    .searchParams.get('path'), 'src/App.tsx:2:1')
})

test('IDEA reports missing configuration, paths outside the project and invalid coordinates', () => {
  assert.throws(() => getUrl({ editor: 'idea', pathToSource: 'src/App.tsx:1:1' }), /projectRoot.*projectName/)
  assert.throws(() => getUrl({ editor: 'idea', pathToSource: 'D:/demo/App.tsx:1:1', projectName: 'demo' }), /projectRoot/)
  assert.throws(() => getUrl({ editor: 'idea', pathToSource: 'D:/demo-other/App.tsx:1:1', projectRoot: 'D:/demo' }), /不在.*projectRoot/)
  assert.throws(() => getUrl({ editor: 'idea', pathToSource: '/Demo/App.tsx:1:1', projectRoot: '/demo' }), /不在.*projectRoot/)
  assert.throws(() => getUrl({ editor: 'idea', pathToSource: 'D:/demo/App.tsx', projectRoot: 'D:/demo' }), /行号:列号/)
})

test('opening resolved Next sources honors each editor after applying the local project root', async (t) => {
  const original = { window: globalThis.window, fetch: globalThis.fetch }
  const urls = []
  globalThis.window = { location: { assign: (url) => urls.push(url) } }
  globalThis.fetch = () => { throw new Error('A configured editor must not be delegated to Next') }
  t.after(() => Object.assign(globalThis, original))
  const source = { fileName: 'app/page.tsx', lineNumber: 5, columnNumber: 8, openWithNext: true }
  for (const editor of ['cursor', 'trae', 'trae-cn', 'idea']) {
    await openSource(source, { editor, projectRoot: 'D:/demo' })
  }
  assert.deepEqual(urls.slice(0, 3), [
    'cursor://file/D:/demo/app/page.tsx:5:8',
    'trae://file/D:/demo/app/page.tsx:5:8',
    'trae-cn://file/D:/demo/app/page.tsx:5:8',
  ])
  assert.equal(new URL(urls[3]).searchParams.get('path'), 'app/page.tsx:4:7')
  await openSource(source, { editor: 'idea', projectName: 'demo' })
  assert.equal(new URL(urls[4]).searchParams.get('project'), 'demo')
  await openSource({ ...source, fileName: '/container/app/Card.tsx' }, {
    editor: 'idea', projectRoot: 'D:/demo', projectName: 'IDE Project',
    pathModifier: (path) => path.replace('/container/', 'D:/demo/'),
  })
  const mapped = new URL(urls[5])
  assert.equal(mapped.searchParams.get('project'), 'IDE Project')
  assert.equal(mapped.searchParams.get('path'), 'app/Card.tsx:4:7')
})
