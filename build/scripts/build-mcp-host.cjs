const path = require('node:path')
const { createRequire } = require('node:module')
const fs = require('node:fs')
const viteRequire = createRequire(require.resolve('vite/package.json'))
const esbuild = viteRequire('esbuild')
fs.mkdirSync(path.resolve('.mcp-build'), { recursive: true })
esbuild.buildSync({
  entryPoints: [path.resolve('scripts/mcp-stdio-host.ts')],
  outfile: path.resolve('.mcp-build/mcp-stdio-host.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'bundle',
  banner: { js: '/* MCP stdio host for Short Video Factory. */' },
})
