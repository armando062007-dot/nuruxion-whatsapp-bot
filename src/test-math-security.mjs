import assert from 'node:assert/strict'
import test from 'node:test'
import { create, all } from 'mathjs'
import { validateScalarMath } from './security.mjs'

const math = create(all, { number: 'number' })
test('el analizador rechaza rangos, matrices, código y operaciones caras antes de ejecutarlos', () => {
  for (const input of ['1:1e9', '[1, 2]', 'x=1', 'import(1)', 'factorial(500000)', 'combinations(1e9, 5e8)', '(10^100)!']) {
    assert.throws(() => validateScalarMath(math.parse(input), true), /no permitida|límite/)
  }
})

test('los cálculos habituales y las ecuaciones conservan el resultado', () => {
  for (const [input, expected] of [['sqrt(81)+3!', 15], ['combinations(5,2)', 10], ['x^2-2*x', 3], ['2(3+4)', 14], ['20% * 100', 20]]) {
    const node = math.parse(input)
    validateScalarMath(node, true)
    assert.equal(node.evaluate({ x: 3 }), expected)
  }
})
