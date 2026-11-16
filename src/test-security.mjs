import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, PassThrough } from 'node:stream'
import { collectBounded, createIngress, createQuestionLimiter, sameAccount, whatsappMediaUrl } from './security.mjs'

const now = 1_700_000_000_000
const group = '123@g.us'
function msg(id, { age = 0, chat = group, actor = 1, text = '?give' } = {}) {
  return { key: { remoteJid: chat, id, participant: `${actor}@s.whatsapp.net` },
    messageTimestamp: (now - age) / 1000, message: { conversation: text } }
}
const options = { allowed: chat => chat === group, now: () => now,
  commandName: message => message.message.conversation.startsWith('?') && message.message.conversation.slice(1),
  durable: command => command === 'give' }

test('descarga multimedia solo de la CDN oficial, sin credenciales ni puertos alternos', () => {
  assert.equal(whatsappMediaUrl({ directPath: '/v/audio?token=x' }), 'https://mmg.whatsapp.net/v/audio?token=x')
  for (const url of ['http://mmg.whatsapp.net/a', 'https://mmg.whatsapp.net.evil.test/a',
    'https://user@mmg.whatsapp.net/a', 'https://mmg.whatsapp.net:8443/a', 'http://127.0.0.1/a']) {
    assert.throws(() => whatsappMediaUrl({ url }), /Origen/)
  }
  assert.throws(() => whatsappMediaUrl({ directPath: '//127.0.0.1/a' }), /Origen/)
})

test('no confunde una cuenta LID con un número en otro dominio', () => {
  assert.equal(sameAccount('123:9@s.whatsapp.net', '123@c.us'), true)
  assert.equal(sameAccount('123@lid', '123@s.whatsapp.net'), false)
  assert.equal(sameAccount('123@g.us', '123@g.us'), false)
})

test('descarta histórico, grupos externos y duplicados incluso al reiniciar', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'nuruxion-security-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const config = { ...options, journal: join(dir, 'seen.json') }
  const accept = createIngress(config)
  assert.equal(accept('append', msg('old')), null)
  assert.equal(accept('notify', msg('old', { age: 301_000 })), null)
  assert.equal(accept('notify', msg('future', { age: -61_000 })), null)
  assert.equal(accept('notify', msg('external', { chat: '456@g.us' })), null)
  accept('notify', msg('same'))()
  assert.equal(accept('notify', msg('same')), null)
  assert.equal(createIngress(config)('notify', msg('same')), null)
})

test('acota los comandos concurrentes por persona y el total por grupo', () => {
  const accept = createIngress(options)
  const release = accept('notify', msg('one'))
  assert.equal(accept('notify', msg('two')), null)
  const others = [2, 3, 4].map(actor => accept('notify', msg(String(actor), { actor })))
  assert.equal(accept('notify', msg('five', { actor: 5 })), null)
  release()
  accept('notify', msg('two'))()
  others.forEach(done => done())
})

test('la IA limita simultaneidad y frecuencia sin bloquear usuarios tras el plazo', () => {
  let time = now
  const start = createQuestionLimiter(() => time)
  const release = start('first')
  const other = start('second')
  assert.equal(start('third'), null)
  release()
  assert.equal(start('first'), null)
  time += 15_000
  start('first')()
  other()
})

test('los adjuntos se limitan en bytes y se cancela una descarga que no responde', async () => {
  assert.deepEqual(await collectBounded(Readable.from(['123', '4']), 4), Buffer.from('1234'))
  await assert.rejects(collectBounded(Readable.from(['123', '45']), 4), /límite/)
  const controller = new AbortController()
  const stream = new PassThrough()
  const reading = collectBounded(stream, 4, controller.signal)
  controller.abort(new Error('timeout'))
  await assert.rejects(reading, /timeout/)
  assert.equal(stream.destroyed, true)
})
