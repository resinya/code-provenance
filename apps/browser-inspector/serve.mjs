import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { buildInspector, outputFile } from './build.mjs'

const port = Number(process.argv[2] || 4179)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Pass a port between 1 and 65535')
}

await buildInspector()

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Private-Network', 'true')
  response.setHeader('Cache-Control', 'no-store')

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' })
    response.end()
    return
  }

  const pathname = new URL(request.url, 'http://127.0.0.1').pathname
  const files = {
    '/inspector.js': [outputFile, 'text/javascript; charset=utf-8'],
    '/inspector.js.map': [outputFile + '.map', 'application/json'],
  }
  const file = files[pathname]
  if (!file) {
    response.writeHead(404)
    response.end('Not found')
    return
  }

  try {
    const content = await readFile(file[0])
    response.writeHead(200, { 'Content-Type': file[1] })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch {
    response.writeHead(500)
    response.end('Could not read the inspector bundle. Rebuild and try again.')
  }
})

server.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
server.listen(port, '127.0.0.1', () => {
  console.log(`Inspector: http://127.0.0.1:${port}/inspector.js`)
  console.log('Run load-in-browser.js in the target page DevTools Snippets.')
  console.log('Ctrl+C stops the server.')
})
