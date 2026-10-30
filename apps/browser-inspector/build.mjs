import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const directory = dirname(fileURLToPath(import.meta.url))

export const outputFile = resolve(directory, 'dist/inspector.js')

export async function buildInspector() {
  const result = await build({
    entryPoints: [resolve(directory, 'src/index.js')],
    outfile: outputFile,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    minify: true,
    sourcemap: true,
    metafile: true,
    define: { 'process.env.NODE_ENV': '"development"' },
    // 工具的所有组件必须使用同一对 React/renderer，
    // 即使 workspace 依赖解析出不同的 React 副本。
    alias: {
      react: dirname(require.resolve('react/package.json')),
      'react-dom': dirname(require.resolve('react-dom/package.json')),
    },
    legalComments: 'inline',
  })

  if (
    Object.values(result.metafile.outputs).some((output) =>
      output.imports.some((dependency) => dependency.external)
    )
  ) {
    throw new Error('The inspector bundle must not depend on external modules')
  }

  return outputFile
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Built ${await buildInspector()}`)
}
