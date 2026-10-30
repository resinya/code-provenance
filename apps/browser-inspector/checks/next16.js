// 通过 Playwright MCP 的 browser_run_code_unsafe 运行，本文件作为 filename 参数。
// 先启动 inspector:serve 和 @code-provenance/next16-fixture 开发服务器。
// source map 与 Next 映射接口使用真实响应，仅拦截编辑器唤起请求，
// 因此该回归用例不会真的打开系统编辑器窗口。
async (page) => {
  const origin = 'http://127.0.0.1:4181'
  const editorRoute = origin + '/__nextjs_launch-editor?**'
  const launches = []
  await page.route(editorRoute, (route) => {
    launches.push(route.request().url())
    return route.fulfill({ status: 204 })
  })
  const readMenu = () => page.getByRole('menuitem').evaluateAll((items) => items.map((item) => ({
    value: item.value, name: item.textContent,
  })))
  try {
    await page.goto(origin)
    await page.waitForFunction(() => Object.keys(document.getElementById('client-target'))
      .some((key) => key.startsWith('__reactFiber')))
    await page.addScriptTag({ url: 'http://127.0.0.1:4179/inspector.js?next16-regression' })
    await page.getByRole('button', { name: '开始选择', exact: true }).click()

    await page.locator('#client-target').click({ button: 'right' })
    await page.getByRole('menuitem').filter({ hasText: 'ClientCard.jsx' }).first().waitFor()
    const client = await readMenu()
    if (!/(?:^|\/)app\/ClientCard.jsx:7:10$/.test(client[0].value)) throw new Error('Wrong client source: ' + JSON.stringify(client))

    await page.keyboard.press('Escape')
    await page.locator('#server-target').click({ button: 'right' })
    await page.getByRole('menuitem').first().waitFor()
    const server = await readMenu()
    if (!/(?:^|\/)app\/page.jsx:5:5$/.test(server[0].value)) throw new Error('Wrong server source: ' + JSON.stringify(server))
    const serverLaunch = page.waitForRequest((request) => request.url().includes('/__nextjs_launch-editor?'))
    await page.getByRole('menuitem').first().click()
    const serverRequest = new URL((await serverLaunch).url())
    if (!serverRequest.searchParams.get('file').endsWith('app/page.jsx') ||
        serverRequest.searchParams.get('line1') !== '5' || serverRequest.searchParams.get('column1') !== '5') {
      throw new Error('Wrong server editor request: ' + serverRequest)
    }

    await page.evaluate(() => window.__CP__.mount({
      pathModifier: (path) => path.replace(/^.*\/fixtures\/next16\//, ''),
    }))
    const clientLaunch = page.waitForRequest((request) => request.url().includes('/__nextjs_launch-editor?'))
    await page.locator('#client-target').click()
    const clientRequest = new URL((await clientLaunch).url())
    if (clientRequest.searchParams.get('file') !== 'app/ClientCard.jsx' ||
        clientRequest.searchParams.get('line1') !== '7' || clientRequest.searchParams.get('column1') !== '10') {
      throw new Error('Wrong client editor request: ' + clientRequest)
    }
    if ((await page.locator('#client-target').textContent()).includes('1')) throw new Error('Selection activated business click')
    await page.getByRole('button', { name: '结束选择', exact: true }).click()
    await page.locator('#client-target').click()
    if (!(await page.locator('#client-target').textContent()).includes('1')) throw new Error('Pause did not restore business clicks')
    await page.getByRole('button', { name: '退出', exact: true }).click()
    if (await page.locator('#code-provenance-browser-inspector').count()) throw new Error('Inspector did not unmount')
    return { client, server, launches, businessClicksRestored: true }
  } finally {
    await page.unroute(editorRoute)
    await page.evaluate(() => window.__CP__?.unmount()).catch(() => {})
  }
}
