import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
const config = source.slice(source.indexOf('const ALLOWED_GROUPS'), source.indexOf('const PREFIX'))
const policy = value => runInNewContext(config + '\nisAllowedGroup', { process: { env: { ALLOWED_GROUP_JIDS: value } } })

test('sin configuración no autoriza ningún grupo', () => {
  assert.equal(policy(undefined)('100@g.us'), false)
  assert.match(source, /if \(!ALLOWED_GROUPS\.size\) throw/)
})

test('acepta solo IDs de grupo expresamente configurados', () => {
  const allowed = policy('100@g.us, status@broadcast, 101@s.whatsapp.net')
  assert.equal(allowed('100@g.us'), true)
  assert.equal(allowed('102@g.us'), false)
  assert.equal(allowed('status@broadcast'), false)
  assert.equal(allowed('101@s.whatsapp.net'), false)
})
