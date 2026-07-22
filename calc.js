// Scientific calculator logic with a compact, data-driven button layout.
(function () {
  "use strict";

  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const serverStatusEl = document.getElementById("serverStatus");
  const degRadBtn = document.getElementById("degRadToggle");
  const buttonsWrap = document.getElementById("buttons");

  let expression = "";
  let justEvaluated = false;
  let angleMode = "DEG";

  const layouts = [
    { className: "scientific", buttons: [
      { label: "AC", action: "clear-all", cls: "func" },
      { label: "CE", action: "clear-entry", cls: "func" },
      { label: "⌫", action: "backspace", cls: "func" },
      { label: "(", value: "(", cls: "func" },
      { label: ")", value: ")", cls: "func" }
    ]},
    { className: "scientific", buttons: [
      { label: "sin", action: "sin", cls: "func" },
      { label: "cos", action: "cos", cls: "func" },
      { label: "tan", action: "tan", cls: "func" },
      { label: "log", action: "log", cls: "func" },
      { label: "ln", action: "ln", cls: "func" }
    ]},
    { className: "scientific", buttons: [
      { label: "√", action: "sqrt", cls: "func" },
      { label: "x²", action: "square", cls: "func" },
      { label: "x^y", action: "power", cls: "func" },
      { label: "x!", action: "factorial", cls: "func" },
      { label: "1/x", action: "inverse", cls: "func" }
    ]},
    { className: "scientific", buttons: [
      { label: "π", action: "pi", cls: "func" },
      { label: "e", action: "e", cls: "func" },
      { label: "%", action: "percent", cls: "func" },
      { label: "±", action: "plusminus", cls: "func" },
      { label: "PHP∑", action: "server-eval", cls: "func", title: "Evaluate on server via PHP" }
    ]},
    { className: "basic", buttons: [
      { label: "7", value: "7", cls: "num" },
      { label: "8", value: "8", cls: "num" },
      { label: "9", value: "9", cls: "num" },
      { label: "÷", value: "/", cls: "op" }
    ]},
    { className: "basic", buttons: [
      { label: "4", value: "4", cls: "num" },
      { label: "5", value: "5", cls: "num" },
      { label: "6", value: "6", cls: "num" },
      { label: "×", value: "*", cls: "op" }
    ]},
    { className: "basic", buttons: [
      { label: "1", value: "1", cls: "num" },
      { label: "2", value: "2", cls: "num" },
      { label: "3", value: "3", cls: "num" },
      { label: "−", value: "-", cls: "op" }
    ]},
    { className: "basic", buttons: [
      { label: "0", value: "0", cls: "num" },
      { label: ".", value: ".", cls: "num" },
      { label: "=", action: "equals", cls: "equals" },
      { label: "+", value: "+", cls: "op" }
    ]}
  ];

  function render() {
    displayEl.value = expression === "" ? "0" : expression;
    expressionEl.textContent = "";
  }

  function append(text) {
    if (justEvaluated) {
      const isOperator = /^[+\-*/^]$/.test(text);
      if (!isOperator) expression = "";
      justEvaluated = false;
    }
    expression += text;
    render();
  }

  function clearAll() {
    expression = "";
    justEvaluated = false;
    serverStatusEl.textContent = "";
    serverStatusEl.className = "";
    render();
  }

  function clearEntry() {
    if (!expression.length) return;
    const funcMatch = expression.match(/(sin|cos|tan|log|ln|sqrt)\($/);
    expression = funcMatch ? expression.slice(0, -funcMatch[0].length) : expression.slice(0, -1);
    render();
  }

  function backspace() { clearEntry(); }

  function evaluateExpression(str) {
    const src = str.replace(/π/g, "pi").replace(/×/g, "*").replace(/÷/g, "/");
    let pos = 0;

    function peek() { return src[pos]; }
    function error(msg) { throw new Error(msg || "Invalid expression"); }
    function parseExpr() { let value = parseTerm(); while (peek() === "+" || peek() === "-") { const op = src[pos++]; const rhs = parseTerm(); value = op === "+" ? value + rhs : value - rhs; } return value; }
    function parseTerm() { let value = parsePower(); while (peek() === "*" || peek() === "/") { const op = src[pos++]; const rhs = parsePower(); if (op === "/") { if (rhs === 0) error("Division by zero"); value = value / rhs; } else { value = value * rhs; } } return value; }
    function parsePower() { let value = parseUnary(); if (peek() === "^") { pos++; const rhs = parsePower(); value = Math.pow(value, rhs); } return value; }
    function parseUnary() { if (peek() === "-") { pos++; return -parseUnary(); } if (peek() === "+") { pos++; return parseUnary(); } return parsePostfix(); }
    function parsePostfix() { let value = parsePrimary(); while (peek() === "!" || peek() === "%") { if (peek() === "!") { pos++; value = factorial(value); } else { pos++; value = value / 100; } } return value; }
    const FUNCS = ["sin", "cos", "tan", "log", "ln", "sqrt"];
    function matchFunc() { for (const f of FUNCS) if (src.startsWith(f, pos)) return f; return null; }
    function parsePrimary() {
      if (peek() === "(") { pos++; const value = parseExpr(); if (peek() !== ")") error("Missing closing parenthesis"); pos++; return value; }
      if (src.startsWith("pi", pos)) { pos += 2; return Math.PI; }
      if (peek() === "e" && !/[a-zA-Z]/.test(src[pos + 1] || "")) { pos += 1; return Math.E; }
      const fn = matchFunc();
      if (fn) { pos += fn.length; if (peek() !== "(") error("Expected '(' after " + fn); pos++; const arg = parseExpr(); if (peek() !== ")") error("Missing closing parenthesis"); pos++; return applyFunc(fn, arg); }
      const start = pos; while (/[0-9.]/.test(peek() || "")) pos++; if (pos === start) error("Unexpected character: " + peek()); const num = parseFloat(src.slice(start, pos)); if (Number.isNaN(num)) error("Invalid number: " + src.slice(start, pos)); return num;
    }
    function applyFunc(fn, arg) {
      const rad = angleMode === "DEG" ? (arg * Math.PI) / 180 : arg;
      switch (fn) {
        case "sin": return Math.sin(rad);
        case "cos": return Math.cos(rad);
        case "tan": return Math.tan(rad);
        case "log": return Math.log10(arg);
        case "ln": return Math.log(arg);
        case "sqrt": if (arg < 0) error("Cannot take sqrt of a negative number"); return Math.sqrt(arg);
        default: error("Unknown function: " + fn);
      }
    }
    function factorial(n) { if (n < 0 || !Number.isInteger(n)) error("Factorial requires a non-negative integer"); let result = 1; for (let i = 2; i <= n; i++) result *= i; return result; }

    if (src.trim() === "") return 0;
    const result = parseExpr();
    if (pos < src.length) error("Unexpected character: " + src[pos]);
    return result;
  }

  function formatResult(num) { if (!Number.isFinite(num)) return "Error"; return String(Math.round(num * 1e10) / 1e10); }

  function doEquals() {
    try {
      const result = evaluateExpression(expression);
      expressionEl.textContent = expression + " =";
      expression = formatResult(result);
      justEvaluated = true;
      render();
    } catch {
      displayEl.value = "Error";
      justEvaluated = true;
      expression = "";
    }
  }

  function toggleSign() {
    const match = expression.match(/(\d+\.?\d*)$/);
    if (!match) return;
    const numStr = match[1];
    const before = expression.slice(0, match.index);
    if (before.endsWith("(-")) expression = before.slice(0, -2) + numStr;
    else if (before.endsWith("-") && !/[0-9)]$/.test(before.slice(0, -1))) expression = before.slice(0, -1) + numStr;
    else expression = before + "(-" + numStr + ")";
    render();
  }

  async function serverEval() {
    if (!expression.trim()) return;
    serverStatusEl.textContent = "Calculating on server…";
    serverStatusEl.className = "";
    try {
      const res = await fetch("/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `expression=${encodeURIComponent(expression)}&angleMode=${angleMode}`
      });
      const data = await res.json();
      if (data.success) {
        expressionEl.textContent = expression + " = (PHP)";
        expression = String(data.result);
        justEvaluated = true;
        render();
        serverStatusEl.textContent = "PHP evaluation OK";
        serverStatusEl.className = "ok";
      } else {
        serverStatusEl.textContent = "PHP error: " + data.error;
        serverStatusEl.className = "error";
      }
    } catch {
      serverStatusEl.textContent = "Server unreachable";
      serverStatusEl.className = "error";
    }
  }

  const handlers = {
    "clear-all": clearAll,
    "clear-entry": clearEntry,
    backspace,
    equals: doEquals,
    sin: () => append("sin("),
    cos: () => append("cos("),
    tan: () => append("tan("),
    log: () => append("log("),
    ln: () => append("ln("),
    sqrt: () => append("sqrt("),
    square: () => append("^2"),
    power: () => append("^"),
    factorial: () => append("!"),
    inverse: () => { expression = `1/(${expression || "0"})`; render(); },
    pi: () => append("π"),
    e: () => append("e"),
    percent: () => append("%"),
    plusminus: toggleSign,
    "server-eval": serverEval
  };

  function buildButtons() {
    const fragment = document.createDocumentFragment();
    layouts.forEach(({ className, buttons }) => {
      const row = document.createElement("div");
      row.className = `row ${className}`;
      buttons.forEach((btn) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `btn ${btn.cls || "num"}`;
        el.textContent = btn.label;
        if (btn.title) el.title = btn.title;
        if (btn.value !== undefined) el.dataset.value = btn.value;
        if (btn.action) el.dataset.action = btn.action;
        el.addEventListener("click", () => {
          if (btn.value !== undefined) append(btn.value);
          else if (btn.action) {
            const action = handlers[btn.action];
            if (action) action();
          }
        });
        row.appendChild(el);
      });
      fragment.appendChild(row);
    });
    buttonsWrap.appendChild(fragment);
  }

  degRadBtn.addEventListener("click", () => {
    angleMode = angleMode === "DEG" ? "RAD" : "DEG";
    degRadBtn.textContent = angleMode;
  });

  document.addEventListener("keydown", (e) => {
    const key = e.key;
    if (/[0-9.]/.test(key)) { append(key); return; }
    if (["+", "-", "*", "/", "^", "(", ")"].includes(key)) { append(key); return; }
    if (key === "Enter" || key === "=") { e.preventDefault(); doEquals(); return; }
    if (key === "Backspace") { backspace(); return; }
    if (key === "Escape") { clearAll(); return; }
  });

  buildButtons();
  render();
})();