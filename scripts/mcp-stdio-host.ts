import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mcpTools } from '../electron/mcp/tool-definitions.js'

function getArgument(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
function findPort() {
  return new Promise<number>((resolve, reject) => {
    const socket = createServer()
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address()
      socket.close(() => typeof address === 'object' && address ? resolve(address.port) : reject(new Error('Could not reserve a local port')))
    })
  })
}
async function main() {
const appPathArg = getArgument('--app-path')
if (!appPathArg) throw new Error('Supply --app-path with the project directory or installed app executable.')
const appPath = path.resolve(appPathArg)
const isProject = fs.existsSync(path.join(appPath, 'package.json'))
if (!isProject && !fs.existsSync(appPath)) throw new Error(`Application path does not exist: ${appPath}`)
const port = await findPort()
const token = randomBytes(32).toString('hex')
let worker: ChildProcess
if (isProject) {
  const electronBin = process.platform === 'win32'
    ? path.join(appPath, 'node_modules', 'electron', 'dist', 'electron.exe')
    : process.platform === 'darwin'
      ? path.join(appPath, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
      : path.join(appPath, 'node_modules', 'electron', 'dist', 'electron')
  if (!fs.existsSync(electronBin)) throw new Error(`Electron is not installed in ${appPath}. Run pnpm install first.`)
  worker = spawn(electronBin, ['--mcp-worker', appPath], { cwd: appPath, env: { ...process.env, SHORT_VIDEO_MCP_PORT: String(port), SHORT_VIDEO_MCP_TOKEN: token }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
} else {
  worker = spawn(appPath, ['--mcp-worker'], { env: { ...process.env, SHORT_VIDEO_MCP_PORT: String(port), SHORT_VIDEO_MCP_TOKEN: token }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
}
worker.stderr?.on('data', (chunk) => process.stderr.write(`[short-video-factory] ${chunk}`))
let shuttingDown = false
const stopWorker = () => { if (shuttingDown) return; shuttingDown = true; worker.kill() }
process.once('exit', stopWorker)
process.once('SIGINT', () => { stopWorker(); process.exit(130) })
process.once('SIGTERM', () => { stopWorker(); process.exit(143) })
worker.once('exit', (code) => { if (!shuttingDown) { process.stderr.write(`[short-video-factory] worker exited (${code})\n`); process.exitCode = code || 1 } })
const headers = { authorization: `Bearer ${token}` }
const deadline = Date.now() + 30000
while (Date.now() < deadline) {
  if (worker.exitCode !== null) throw new Error(`Electron worker exited (${worker.exitCode})`)
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { headers, signal: AbortSignal.timeout(500) })
    if (response.ok) break
  } catch { await new Promise((resolve) => setTimeout(resolve, 150)) }
}
if (Date.now() >= deadline) { stopWorker(); throw new Error('Electron worker did not become ready within 30 seconds') }

const server = new Server({ name: 'short-video-factory', version: '1.0.0' }, { capabilities: { tools: {} } })
server.onerror = (error) => process.stderr.write(`[MCP] ${error.message}\n`)
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }))
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/tool`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: request.params.name, arguments: request.params.arguments ?? {} }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return { content: [{ type: 'text', text: `Renderer worker request failed (${response.status})` }], isError: true }
    return await response.json() as { content: { type: 'text'; text: string }[]; isError?: boolean }
  } catch (error) {
    return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true }
  }
})
const transport = new StdioServerTransport()
await server.connect(transport)
process.stdin.once('end', () => { void server.close().finally(stopWorker) })
}
main().catch((error: unknown) => { process.stderr.write(`[short-video-factory] ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1 })
