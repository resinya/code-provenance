// 通过 Playwright MCP 的 browser_run_code_unsafe 的 filename 参数运行。
// 该用例检查原生浏览器的命中测试行为，JSDOM 无法复现。
async (page) => {
  const base = 'http://127.0.0.1:4179'
  const url = base + '/cp-overlay-regression'
  await page.route(url, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><head><style>
      #mb-ruler { position:fixed; inset:0; z-index:999999; pointer-events:none }
      #ruler-handle { position:absolute; left:0; top:0; width:20px; height:20px;
        pointer-events:auto }
    </style></head><body style="margin:0">
      <button id="page-setting" style="position:absolute;left:100px;top:100px;width:180px;height:80px">
        Page settings
      </button>
      <div id="mb-ruler"><div id="ruler-handle"></div></div>
    </body></html>`,
  }))
  try {
    await page.goto(url)
    const readHits = () => page.evaluate(() => ({
      hit: document.elementFromPoint(180, 140).id,
      pointerEvents: getComputedStyle(document.getElementById('mb-ruler')).pointerEvents,
      handleHit: document.elementFromPoint(10, 10).id,
    }))
    const before = await readHits()
    await page.addScriptTag({ url: base + '/inspector.js?overlay-regression' })
    await page.getByRole('button', { name: '开始选择', exact: true }).click()
    await page.mouse.move(180, 140)
    await page.waitForFunction(() => document.body.dataset.codeProvenance === 'HOVER')
    const after = await readHits()
    if (before.hit !== 'page-setting' || after.hit !== 'page-setting' ||
        after.pointerEvents !== 'none' || after.handleHit !== 'ruler-handle') {
      throw new Error('Overlay regression: ' + JSON.stringify({ before, after }))
    }
    await page.getByRole('button', { name: '退出', exact: true }).click()
    const unmounted = await readHits()
    if (unmounted.hit !== 'page-setting') throw new Error('Hit testing changed after unmount')
    return { before, after, unmounted }
  } finally {
    await page.unroute(url)
  }
}
