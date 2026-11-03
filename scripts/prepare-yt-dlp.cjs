const axios = require('axios')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

// Official standalone binaries. Pin both the version and digest so a release
// never silently packages an unexpected executable.
const version = '2026.10.26'
const binaries = {
  'win32-x64': ['yt-dlp.exe', 'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d'],
  'linux-x64': ['yt-dlp_linux', '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795'],
  'darwin-x64': ['yt-dlp_macos', '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa'],
  'darwin-arm64': ['yt-dlp_macos', '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa'],
}
const selected = binaries[`${process.platform}-${process.arch}`]
if (!selected) throw new Error(`No bundled yt-dlp binary for ${process.platform}-${process.arch}`)
const destination = path.resolve(__dirname, '../vendor/yt-dlp')
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex')

async function prepare(name, url, expected, executable = false) {
  const target = path.join(destination, name)
  let current
  try { current = await fs.readFile(target) } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (!current || digest(current) !== expected) {
    console.log(`Downloading ${name} (yt-dlp ${version})`)
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxContentLength: 100 * 1024 * 1024 })
    const data = Buffer.from(response.data)
    if (digest(data) !== expected) throw new Error(`SHA-256 verification failed for ${name}`)
    const temp = `${target}.${crypto.randomBytes(8).toString('hex')}.tmp`
    try {
      await fs.writeFile(temp, data, { flag: 'wx' })
      await fs.rename(temp, target)
    } finally {
      await fs.rm(temp, { force: true })
    }
  }
  if (executable && process.platform !== 'win32') await fs.chmod(target, 0o755)
}

async function main() {
  await fs.mkdir(destination, { recursive: true })
  const [binary, hash] = selected
  await prepare(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp', `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${binary}`, hash, true)
  const source = `https://raw.githubusercontent.com/yt-dlp/yt-dlp/${version}`
  await prepare('LICENSE.txt', `${source}/LICENSE`, '7e12e5df4bae12cb21581ba157ced20e1986a0508dd10d0e8a4ab9a4cf94e85c')
  await prepare('THIRD_PARTY_LICENSES.txt', `${source}/THIRD_PARTY_LICENSES.txt`, '472aefe951c7db35e1657c1d13fd337140511ed6f2b329205105ad441c5a02b7')
  console.log('yt-dlp and license files verified')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
