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
assert.equal(distro.servers.length, 2)
assert.deepEqual(distro.servers.map(server => server.id), ['DiamondCK-26.2', 'MaybeSurvival-26.3'])
const server = distro.servers[0]
assert.equal(server.id, 'DiamondCK-26.2')
assert.equal(server.name, '꼼모리님 다이아')
assert.equal(server.address, 'alicehiyam.dreamcraft.kr:25567')
assert.equal(server.mainServer, true)
assert.equal(server.minecraftVersion, '26.2')
assert.doesNotMatch(distroText, /AliceGameLand-Distribution|Dot0420|AliceDiamondClient|alice-diamond\.zip/)
assert.equal(server.modules.some(module => module.artifact?.path?.startsWith('resourcepacks/')), false)
const base = new URL('.', server.icon)
assert.equal(base.origin, 'https://github.com')
assert.ok(base.pathname.startsWith('/AliceGameLand/Dot-Distribution/releases/download/'))
let moduleCount = 0
const modules = []
function visit(module, paths) {
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
    for (const child of module.subModules ?? []) visit(child, paths)
    moduleCount++
}
const pathsByServer = new Map()
for (const instance of distro.servers) {
    const instancePaths = new Set()
    pathsByServer.set(instance.id, instancePaths)
    assert.equal(instance.mainServer, instance.id === 'DiamondCK-26.2')
    assert.equal(new URL('.', instance.icon).href, base.href)
    for (const module of instance.modules) visit(module, instancePaths)
    for (const destination of ['options.txt', 'config/iris.properties', 'servers.dat']) {
        assert.ok(instancePaths.has(destination))
        assert.equal(instance.modules.find(module => module.artifact.path === destination)?.artifact.MD5, undefined)
    }
    const configPrefix = instance.id === 'DiamondCK-26.2' ? 'defaults' : 'defaults/survival'
    for (const [destination, pattern] of [
        ['options.txt', /^tutorialStep:none$/m], ['options.txt', /^guiScale:4$/m],
        ['config/iris.properties', /^enableShaders=true$/m],
        ['config/iris.properties', /^shaderPack=ComplementaryReimagined_r5.9.1.zip$/m]
    ]) {
        const configModule = instance.modules.find(module => module.artifact.path === destination)
        const content = remote ? (await download(configModule.artifact.url)).toString('utf8')
            : await fs.readFile(path.join(root, configPrefix, destination), 'utf8')
        assert.match(content, pattern)
    }
    assert.ok(instancePaths.has('shaderpacks/ComplementaryReimagined_r5.9.1.zip'))
    const list = await fs.readFile(path.join(root, configPrefix, 'servers.dat'))
    assert.equal(list[0], 10)
    assert.ok(list.includes(Buffer.from(instance.name)))
    assert.ok(list.includes(Buffer.from(instance.address)))
}
const survival = distro.servers[1]
assert.equal(survival.name, '아마도 야생')
assert.equal(survival.minecraftVersion, '26.3')
assert.equal(survival.address, 'oracle01.dreamcraft.kr:25566')
assert.ok(survival.modules.some(module => module.type === 'Fabric'))
assert.equal(survival.modules.some(module => module.type === 'NeoForge'), false)
const survivalMods = [...pathsByServer.get(survival.id)].filter(destination => destination.startsWith('mods/'))
assert.doesNotMatch(survivalMods.join(' '), /hud|donation|sophisticated|journeymap|xaero|voxelmap/i)
for (const prefix of ['fabric-api-', 'sodium-', 'iris-', 'koreanify-', 'moreculling-', 'dynamic-fps-', 'ferritecore-', 'ImmediatelyFast-', 'lithium-', 'cloth-config-']) {
    assert.ok(survivalMods.some(name => path.basename(name).startsWith(prefix)), `Required Survival mod missing: ${prefix}`)
}
const paths = pathsByServer.get(server.id)
const modNames = [...paths].filter(destination => destination.startsWith('mods/'))
assert.equal(modNames.some(name => /journeymap|xaero|voxelmap/i.test(name)), false, 'Minimap must not be installed')
for (const prefix of ['donation-', 'sophisticatedbackpacks-', 'sophisticatedcore-', 'sodium-', 'iris-', 'koreanify-']) {
    assert.ok(modNames.some(name => path.basename(name).startsWith(prefix)), `Required mod missing: ${prefix}`)
}
assert.ok(modNames.includes('mods/donation-neoforge-26.2-3.0.1-kkommoli.jar'), 'Kkommoli donation relay missing')
assert.ok(modNames.includes('mods/KkommoliDiamondBridge-1.0.0.jar'), 'Required donation bridge missing')
assert.ok(modules.find(module => module.artifact.path === 'mods/KkommoliDiamondBridge-1.0.0.jar')?.artifact.MD5, 'HUD update must be hash-checked')
assert.equal(modNames.filter(name => path.basename(name).startsWith('donation-')).length, 1, 'Duplicate donation mods')
assert.equal(modNames.includes('mods/donation-neoforge-26.2-3.0.1-patched.jar'), false, 'Retired Alice relay must not be installed')
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
    if (record.name === 'mods--KkommoliDiamondBridge-1.0.0.jar') {
        for (const entry of ['client/GoalHud.class', 'client/GoalHudModel.class', 'bridge/GoalHudPayload.class',
            'client/DonationRelay.class', 'bridge/DonationSettingsPayload.class']) {
            assert.ok(bytes.includes(Buffer.from(`kr/kkommoli/diamond/${entry}`)), `HUD class missing: ${entry}`)
        }
    }
    if (record.source) assert.deepEqual(bytes, await fs.readFile(path.join(root, record.source)), record.name)
    for (const module of modules.filter(module => decodeURIComponent(new URL(module.artifact.url).pathname.split('/').at(-1)) === record.name)) {
        assert.equal(module.artifact.size, record.size, module.id)
        if (module.artifact.MD5) assert.equal(module.artifact.MD5, record.MD5, module.id)
    }
}
for (const module of modules.filter(module => module.artifact.url.startsWith(base.href))) {
    assert.ok(names.has(decodeURIComponent(new URL(module.artifact.url).pathname.split('/').at(-1))))
}
const grassIcon = await fs.readFile(path.join(root, 'metadata/grass-block.png'))
assert.equal(grassIcon.toString('ascii', 1, 4), 'PNG')
assert.equal(grassIcon.readUInt32BE(16), 64)
assert.equal(grassIcon.readUInt32BE(20), 64)
if (remote) {
    const live = await download('https://github.com/AliceGameLand/Dot-Distribution/releases/latest/download/distribution.json')
    assert.deepEqual(JSON.parse(live.toString()), distro)
}
console.log(`PASS: ${modNames.length} Diamond mods, ${survivalMods.length} Survival mods, ${moduleCount} modules, ${records.length} ${remote ? 'published' : 'staged'} assets, hashes and isolated configuration.`)
