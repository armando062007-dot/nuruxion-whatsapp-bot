import assert from 'node:assert/strict'
import { STORY_LINES, createNarrative } from './narrative.mjs'

let time = 1800000000000
let seed = 42
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const story = createNarrative({ random, now: () => time })
assert.equal(Object.values(STORY_LINES).flat().length, 52)
for (const [kind, lines] of Object.entries(STORY_LINES)) {
  const seen = new Set()
  let previous = ''
  for (let i = 0; i < lines.length; i++) {
    let text = ''
    for (let tries = 0; tries < 100 && !text; tries++) {
      time += 86400000
      text = story(kind, kind + '-test')
    }
    assert.ok(text.startsWith('\n\n📖 *Apunte del viajero*\n'))
    assert.notEqual(text, previous)
    assert.ok(!seen.has(text), kind + ' repeats before exhausting the pool')
    seen.add(text)
    previous = text
  }
}
const first = story('missions', 'stable')
assert.equal(story('missions', 'stable'), first)
const frequent = createNarrative({ random: () => 0, now: () => time })
assert.ok(frequent('work','u'))
assert.equal(frequent('work','u'), '')
time += 30 * 60000
assert.ok(frequent('work','u'))
assert.ok(frequent('dungeon','u'))
assert.equal(frequent('dungeon','u'), '')
const noChance = createNarrative({ random: () => 0.99 })
assert.equal(noChance('work','u'), '')
assert.equal(noChance('dungeon','u'), '')
assert.equal(story('unknown','u'), '')
// Bounded memory tolerates eviction without breaking generation.
const bounded = createNarrative({ random, maxUsers: 2 })
for (let i = 0; i < 100; i++) assert.ok(bounded('daily', 'user' + i))
