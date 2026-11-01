import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDirectory = path.join(root, '.release-assets')
const distro = JSON.parse(await fs.readFile(path.join(root, 'distribution.json'), 'utf8'))
const records = JSON.parse(await fs.readFile(path.join(root, 'artifacts.json'), 'utf8'))
const base = new URL('.', distro.servers[0].icon)
const hash = (bytes, algorithm) => createHash(algorithm).update(bytes).digest('hex')
await fs.mkdir(releaseDirectory, { recursive: true })

for (const record of records) {
    if (path.basename(record.name) !== record.name) throw new Error(`Invalid asset name: ${record.name}`)
    const target = path.join(releaseDirectory, record.name)
    let bytes
    if (record.source) {
        const source = path.resolve(root, record.source)
        if (!source.startsWith(root + path.sep)) throw new Error(`Invalid source: ${record.source}`)
        bytes = await fs.readFile(source)
    } else {
        bytes = await fs.readFile(target).catch(async () => {
            // 초기 가져오기 이후에는 도트 저장소만 사용해 릴리스 파일을 복구한다.
            const response = await fetch(new URL(encodeURIComponent(record.name), base))
            if (!response.ok) throw new Error(`Asset download failed: ${record.name} (${response.status})`)
            return Buffer.from(await response.arrayBuffer())
        })
        if (hash(bytes, 'sha256') !== record.SHA256) throw new Error(`SHA-256 mismatch: ${record.name}`)
    }
    record.size = bytes.length
    record.MD5 = hash(bytes, 'md5')
    record.SHA256 = hash(bytes, 'sha256')
    await fs.writeFile(target, bytes)
}

const byName = new Map(records.map(record => [record.name, record]))
function updateModule(module) {
    const url = new URL(module.artifact.url)
    if (url.href.startsWith(base.href)) {
        const record = byName.get(decodeURIComponent(url.pathname.split('/').at(-1)))
        if (!record) throw new Error(`Untracked release asset: ${url.href}`)
        module.artifact.size = record.size
        // MD5가 없는 초기 설정 파일은 계속 사용자 설정을 보존한다.
        if (module.artifact.MD5) module.artifact.MD5 = record.MD5
    }
    for (const child of module.subModules ?? []) updateModule(child)
}
for (const server of distro.servers) for (const module of server.modules) updateModule(module)
const manifest = JSON.stringify(distro, null, 2) + '\n'
await fs.writeFile(path.join(root, 'artifacts.json'), JSON.stringify(records, null, 2) + '\n')
await fs.writeFile(path.join(root, 'distribution.json'), manifest)
await fs.writeFile(path.join(releaseDirectory, 'distribution.json'), manifest)
console.log(`Prepared ${records.length} assets and distribution.json.`)
