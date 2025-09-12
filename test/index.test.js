'use strict'
const test = require('brittle')
const b4a = require('b4a')
const sodium = require('sodium-native')
const IPC = require('pear-ipc')
const { isWindows } = require('which-runtime')
const AppDrive = require('..')

function pipeId (s) {
  const buf = b4a.allocUnsafe(32)
  sodium.crypto_generichash(buf, b4a.from(s))
  return b4a.toString(buf, 'hex')
}

test('throws if not Pear', (t) => {
  t.exception(() => new AppDrive())
})

test('AppDrive', async (t) => {
  t.plan(5)

  const kIPC = Symbol('test.ipc')
  const socketPath = isWindows ? `\\\\.\\pipe\\test-${pipeId(__dirname)}` : __dirname + '/test.sock' // eslint-disable-line
  const srv = new IPC.Server({
    socketPath,
    handlers: {
      async get ({ key, ...opts }) {
        return { key, opts, value: `v:${key}` }
      },
      async exists ({ key }) {
        return key === 'present'
      },
      async entry ({ key }) {
        return { key, seq: 1 }
      },
      async compare ({ keyA, keyB }) {
        return keyA.localeCompare(keyB)
      }
    }
  })
  t.teardown(() => srv.close())
  await srv.ready()

  const ipc = new IPC.Client({ socketPath })
  t.teardown(() => ipc.close())
  await ipc.ready()

  class API {
    static IPC = kIPC
    get [kIPC] () { return ipc }
  }
  global.Pear = new API()

  const drive = new AppDrive()
  t.teardown(() => drive.close())
  await drive.ready()
  const got = await drive.get('a', { foo: 1 })
  t.alike(got, { key: 'a', opts: { foo: 1 }, value: 'v:a' })

  const ex1 = await drive.exists('present')
  const ex2 = await drive.exists('missing')
  t.is(ex1, true)
  t.is(ex2, false)

  const ent = await drive.entry('k')
  t.alike(ent, { key: 'k', seq: 1 })

  const cmp = await drive.compare('a', 'b')
  t.is(cmp < 0, true)
})

test('not implemented', async (t) => {
  t.plan(7)

  const kIPC = Symbol('test.ipc')
  class API {
    static IPC = kIPC
    get [kIPC] () { return {} } // truthy IPC so constructor passes
  }
  global.Pear = new API()

  const drive = new AppDrive()
  t.teardown(() => drive.close())
  await drive.ready()
  t.exception(() => drive.put(), /not implemented/)
  t.exception(() => drive.del(), /not implemented/)
  t.exception(() => drive.symlink(), /not implemented/)
  t.exception(() => drive.readdir(), /not implemented/)
  t.exception(() => drive.mirror(), /not implemented/)
  t.exception(() => drive.createReadStream(), /not implemented/)
  t.exception(() => drive.createWriteStream(), /not implemented/)
})

test('batch returns self', (t) => {
  t.plan(1)

  const kIPC = Symbol('test.ipc')
  class API {
    static IPC = kIPC
    get [kIPC] () { return {} } // truthy IPC so constructor passes
  }
  global.Pear = new API()

  const drive = new AppDrive()
  t.teardown(() => drive.close())
  t.is(drive.batch(), drive)
})

test('checkout returns self', (t) => {
  t.plan(1)

  const kIPC = Symbol('test.ipc')
  class API {
    static IPC = kIPC
    get [kIPC] () { return {} } // truthy IPC so constructor passes
  }
  global.Pear = new API()

  const drive = new AppDrive()
  t.teardown(() => drive.close())
  t.is(drive.checkout(), drive)
})
