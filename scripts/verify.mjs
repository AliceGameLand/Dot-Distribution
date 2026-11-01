import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const remote = process.argv.includes('--remote')
const distroText = await fs.readFile(path.join(root, 'distribution.json'), 'utf8')
const distro = JSON.parse(distroText)
const records = JSON.parse(await fs.readFile(path.join(root, 'artifacts.json'), 'utf8'))
const hash = (bytes, algorithm) => createHash(algorithm).update(bytes).digest('hex')
const download = async url => {
    const response = await fetch(url)
    assert.equal(response.status, 200, `Download failed: ${url}`)
    return Buffer.from(await response.arrayBuffer())
}
assert.equal(distro.servers.length, 1)
const server = distro.servers[0]
assert.equal(server.id, 'DiamondCK-26.2')
assert.equal(server.name, '꼬몰리님 다이아')
assert.equal(server.address, 'alicehiyam.dreamcraft.kr:25568')
assert.equal(server.mainServer, true)
assert.equal(server.minecraftVersion, '26.2')
assert.doesNotMatch(distroText, /AliceGameLand-Distribution|Dot0420|AliceDiamondClient|alice-diamond\.zip/)
assert.equal(server.modules.some(module => module.artifact?.path?.startsWith('resourcepacks/')), false)
const base = new URL('.', server.icon)
assert.equal(base.origin, 'https://github.com')
assert.ok(base.pathname.startsWith('/AliceGameLand/Dot-Distribution/releases/download/'))
const paths = new Set()
let moduleCount = 0
const modules = []
function visit(module) {
    modules.push(module)
    assert.ok(Number.isInteger(module.artifact.size) && module.artifact.size > 0)
    const url = new URL(module.artifact.url)
    assert.equal(url.protocol, 'https:')
    if (module.artifact.path) {
        const destination = module.artifact.path
        assert.equal(path.isAbsolute(destination), false)
        assert.equal(destination.split(/[\\/]/).includes('..'), false)
        assert.equal(paths.has(destination), false, `Duplicate file: ${destination}`)
        paths.add(destination)
        assert.ok(url.href.startsWith(base.href), `File outside own distribution: ${destination}`)
    }
    for (const child of module.subModules ?? []) visit(child)
    moduleCount++
}
for (const module of server.modules) visit(module)
const modNames = [...paths].filter(destination => destination.startsWith('mods/'))
for (const prefix of ['donation-', 'sophisticatedbackpacks-', 'sophisticatedcore-', 'sodium-', 'iris-', 'koreanify-', 'journeymap-']) {
    assert.ok(modNames.some(name => path.basename(name).startsWith(prefix)), `Required mod missing: ${prefix}`)
}
for (const destination of ['options.txt', 'config/iris.properties', 'servers.dat']) {
    assert.equal(server.modules.find(module => module.artifact.path === destination)?.artifact.MD5, undefined)
    assert.ok(paths.has(destination))
}
const names = new Set()
for (const record of records) {
    assert.equal(path.basename(record.name), record.name)
    assert.equal(names.has(record.name), false)
    names.add(record.name)
    const bytes = remote
        ? await download(new URL(encodeURIComponent(record.name), base))
        : await fs.readFile(path.join(root, '.release-assets', record.name))
    assert.equal(bytes.length, record.size, record.name)
    assert.equal(hash(bytes, 'md5'), record.MD5, record.name)
    assert.equal(hash(bytes, 'sha256'), record.SHA256, record.name)
    if (record.source) assert.deepEqual(bytes, await fs.readFile(path.join(root, record.source)), record.name)
    for (const module of modules.filter(module => decodeURIComponent(new URL(module.artifact.url).pathname.split('/').at(-1)) === record.name)) {
        assert.equal(module.artifact.size, record.size, module.id)
        if (module.artifact.MD5) assert.equal(module.artifact.MD5, record.MD5, module.id)
    }
}
for (const module of modules.filter(module => module.artifact.url.startsWith(base.href))) {
    assert.ok(names.has(decodeURIComponent(new URL(module.artifact.url).pathname.split('/').at(-1))))
}
const options = await fs.readFile(path.join(root, 'defaults/options.txt'), 'utf8')
assert.match(options, /^tutorialStep:none$/m)
assert.match(options, /^guiScale:4$/m)
assert.doesNotMatch(options, /alice-diamond|AliceDiamond/)
const iris = await fs.readFile(path.join(root, 'defaults/config/iris.properties'), 'utf8')
assert.match(iris, /^enableShaders=true$/m)
assert.match(iris, /^shaderPack=ComplementaryReimagined_r5.9.1.zip$/m)
const serverList = await fs.readFile(path.join(root, 'defaults/servers.dat'))
assert.equal(serverList[0], 10)
assert.ok(serverList.includes(Buffer.from('꼬몰리님 다이아')))
assert.ok(serverList.includes(Buffer.from(server.address)))
if (remote) {
    const live = await download('https://github.com/AliceGameLand/Dot-Distribution/releases/latest/download/distribution.json')
    assert.deepEqual(JSON.parse(live.toString()), distro)
}
console.log(`PASS: ${modNames.length} mods, ${moduleCount} modules, ${records.length} ${remote ? 'published' : 'staged'} assets, hashes and isolated configuration.`)
