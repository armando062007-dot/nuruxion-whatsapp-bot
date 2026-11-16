import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function accountId(value) {
  const match = /^(\d+)(?::\d+)?@(s\.whatsapp\.net|c\.us|lid)$/.exec(String(value || ''))
  return match ? match[1] + '@' + (match[2] === 'c.us' ? 's.whatsapp.net' : match[2]) : null
}

export function sameAccount(a, b) {
  const id = accountId(a)
  return id !== null && id === accountId(b)
}

export function whatsappMediaUrl({ url, directPath } = {}) {
  const base = new URL(url || 'https://mmg.whatsapp.net/')
  const target = directPath ? new URL(directPath, base.origin) : base
  if (target.protocol !== 'https:' || target.port || target.username || target.password ||
      !/^mmg(?:-[a-z0-9-]+)?\.whatsapp\.net$/.test(target.hostname)) {
    throw new Error('Origen del adjunto no permitido')
  }
  return target.href
}

export function createIngress({ allowed, commandName, durable = () => false, journal, now = Date.now, ttl = 300_000 } = {}) {
  const seen = new Map(), groupJobs = new Map(), actorJobs = new Set()
  let active = 0, durableIds
  function reserve(key, time) {
    if (!journal) return true
    if (!durableIds) {
      try { durableIds = new Map(JSON.parse(readFileSync(journal, 'utf8'))) }
      catch (error) { if (error.code !== 'ENOENT') throw error; durableIds = new Map() }
    }
    for (const [id, expiry] of durableIds) if (expiry <= time) durableIds.delete(id)
    if (durableIds.has(key) || durableIds.size >= 4096) return false
    const next = new Map(durableIds).set(key, time + ttl)
    mkdirSync(dirname(journal), { recursive: true, mode: 0o700 })
    writeFileSync(journal + '.tmp', JSON.stringify([...next]), { mode: 0o600 })
    renameSync(journal + '.tmp', journal)
    durableIds = next
    return true
  }
  return (type, message) => {
    const chat = message?.key?.remoteJid, id = message?.key?.id
    const time = now(), timestamp = Number(message?.messageTimestamp) * 1000
    if (type !== 'notify' || !allowed(chat) || typeof id !== 'string' || !id || id.length > 128 ||
        !Number.isFinite(timestamp) || timestamp < time - ttl || timestamp > time + 60_000 || !message.message) return null
    const key = createHash('sha256').update(chat + '\0' + id).digest('hex')
    if (seen.size) for (const [old, expiry] of seen) {
      if (expiry > time) break
      seen.delete(old)
    }
    if (seen.has(key) || seen.size >= 25_000) return null
    const actor = chat + '\0' + (message.key.fromMe ? 'self' : accountId(message.key.participantAlt) || accountId(message.key.participant) || 'unknown')
    const command = commandName(message)
    const count = groupJobs.get(chat) || 0
    if (active >= 16 || count >= 4 || (command && actorJobs.has(actor))) return null
    if (command && durable(command) && !reserve(key, time)) return null
    seen.set(key, time + ttl)
    active++
    groupJobs.set(chat, count + 1)
    if (command) actorJobs.add(actor)
    return () => {
      active--
      const left = groupJobs.get(chat) - 1
      if (left) groupJobs.set(chat, left)
      else groupJobs.delete(chat)
      if (command) actorJobs.delete(actor)
    }
  }
}

export function createQuestionLimiter(now = Date.now) {
  const recent = new Map()
  let active = 0
  return key => {
    const time = now()
    for (const [actor, expiry] of recent) {
      if (expiry > time) break
      recent.delete(actor)
    }
    if (active >= 2 || recent.has(key) || recent.size >= 2048) return null
    recent.set(key, time + 15_000)
    active++
    return () => { active-- }
  }
}

export async function collectBounded(stream, maxBytes, signal) {
  const chunks = []
  let bytes = 0
  const abort = () => stream.destroy?.(signal.reason)
  signal?.throwIfAborted()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    for await (const chunk of stream) {
      signal?.throwIfAborted()
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > maxBytes) throw new Error('El archivo supera el límite permitido')
      chunks.push(buffer)
    }
    return Buffer.concat(chunks, bytes)
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}
