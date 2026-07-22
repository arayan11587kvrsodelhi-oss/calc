const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

function evaluateExpression(str, angleMode = 'DEG') {
  const src = str.replace(/π/g, 'pi').replace(/×/g, '*').replace(/÷/g, '/');
  let pos = 0;

  function peek() { return src[pos]; }
  function error(msg) { throw new Error(msg || 'Invalid expression'); }
  function parseExpr() { let value = parseTerm(); while (peek() === '+' || peek() === '-') { const op = src[pos++]; const rhs = parseTerm(); value = op === '+' ? value + rhs : value - rhs; } return value; }
  function parseTerm() { let value = parsePower(); while (peek() === '*' || peek() === '/') { const op = src[pos++]; const rhs = parsePower(); if (op === '/') { if (rhs === 0) error('Division by zero'); value = value / rhs; } else { value = value * rhs; } } return value; }
  function parsePower() { let value = parseUnary(); if (peek() === '^') { pos++; const rhs = parsePower(); value = Math.pow(value, rhs); } return value; }
  function parseUnary() { if (peek() === '-') { pos++; return -parseUnary(); } if (peek() === '+') { pos++; return parseUnary(); } return parsePostfix(); }
  function parsePostfix() { let value = parsePrimary(); while (peek() === '!' || peek() === '%') { if (peek() === '!') { pos++; value = factorial(value); } else { pos++; value = value / 100; } } return value; }
  const FUNCS = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt'];
  function matchFunc() { for (const fn of FUNCS) if (src.startsWith(fn, pos)) return fn; return null; }
  function parsePrimary() {
    if (peek() === '(') { pos++; const value = parseExpr(); if (peek() !== ')') error('Missing closing parenthesis'); pos++; return value; }
    if (src.startsWith('pi', pos)) { pos += 2; return Math.PI; }
    if (peek() === 'e' && !/[a-zA-Z]/.test(src[pos + 1] || '')) { pos += 1; return Math.E; }
    const fn = matchFunc();
    if (fn) { pos += fn.length; if (peek() !== '(') error('Expected ( after ' + fn); pos++; const arg = parseExpr(); if (peek() !== ')') error('Missing closing parenthesis'); pos++; return applyFunc(fn, arg); }
    const start = pos; while (/[0-9.]/.test(peek() || '')) pos++; if (pos === start) error('Unexpected character: ' + peek()); const num = parseFloat(src.slice(start, pos)); if (Number.isNaN(num)) error('Invalid number: ' + src.slice(start, pos)); return num;
  }
  function applyFunc(fn, arg) {
    const rad = angleMode === 'DEG' ? (arg * Math.PI) / 180 : arg;
    switch (fn) {
      case 'sin': return Math.sin(rad);
      case 'cos': return Math.cos(rad);
      case 'tan': return Math.tan(rad);
      case 'log': return Math.log10(arg);
      case 'ln': return Math.log(arg);
      case 'sqrt': if (arg < 0) error('Cannot take sqrt of a negative number'); return Math.sqrt(arg);
      default: error('Unknown function: ' + fn);
    }
  }
  function factorial(n) { if (n < 0 || !Number.isInteger(n)) error('Factorial requires a non-negative integer'); let result = 1; for (let i = 2; i <= n; i++) result *= i; return result; }

  if (src.trim() === '') return 0;
  const result = parseExpr();
  if (pos < src.length) error('Unexpected character: ' + src[pos]);
  return result;
}

app.post('/evaluate', (req, res) => {
  try {
    const expression = req.body.expression || '';
    const angleMode = req.body.angleMode || 'DEG';
    if (!expression.trim()) {
      return res.json({ success: false, error: 'No expression provided' });
    }
    const result = evaluateExpression(expression, angleMode);
    res.json({ success: true, result: Number.isFinite(result) ? Number(result.toFixed(10)) : null });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Calculator server running at http://localhost:${port}`);
});

module.exports = { evaluateExpression };
