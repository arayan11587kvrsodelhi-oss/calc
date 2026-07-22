const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateExpression } = require('../server');

test('evaluates basic arithmetic', () => {
  assert.equal(evaluateExpression('2+3*4'), 14);
});

test('supports functions and constants', () => {
  assert.equal(evaluateExpression('sin(0)'), 0);
  assert.equal(evaluateExpression('2+pi'), Math.PI + 2);
});

test('throws on division by zero', () => {
  assert.throws(() => evaluateExpression('1/0'), /Division by zero/);
});
