// script.js — Scientific Calculator client-side logic
// Handles UI events, builds an expression string, evaluates it with a safe
// recursive-descent parser (no eval()), and optionally sends the expression
// to calculate.php for a server-side (PHP) evaluation.

(function () {
  "use strict";

  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const serverStatusEl = document.getElementById("serverStatus");
  const degRadBtn = document.getElementById("degRadToggle");

  let expression = "";   // the string being built, e.g. "12+sin(30)"
  let justEvaluated = false;
  let angleMode = "DEG"; // "DEG" or "RAD"

  // ---------- Display helpers ----------

  function render() {
    displayEl.value = expression === "" ? "0" : expression;
    expressionEl.textContent = "";
  }

  function append(text) {
    if (justEvaluated) {
      // Start fresh after a result, unless the user is continuing with an operator
      const isOperator = /^[+\-*/^]$/.test(text);
      if (!isOperator) {
        expression = "";
      }
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
    // Remove the last "token" (number, function name, or symbol)
    if (expression.length === 0) return;
    const funcMatch = expression.match(/(sin|cos|tan|log|ln|sqrt)\($/);
    if (funcMatch) {
      expression = expression.slice(0, -funcMatch[0].length);
    } else {
      expression = expression.slice(0, -1);
    }
    render();
  }

  function backspace() {
    clearEntry();
  }

  // ---------- Parser / Evaluator ----------
  // Grammar:
  //   expr   := term (('+'|'-') term)*
  //   term   := power (('*'|'/') power)*
  //   power  := unary ('^' unary)*        (right-associative)
  //   unary  := '-' unary | postfix
  //   postfix:= primary ('!' | '%')*
  //   primary:= number | 'pi' | 'e' | '(' expr ')' | func '(' expr ')'

  function evaluateExpression(str) {
    const src = str.replace(/π/g, "pi").replace(/×/g, "*").replace(/÷/g, "/");
    let pos = 0;

    function peek() {
      return src[pos];
    }

    function error(msg) {
      throw new Error(msg || "Invalid expression");
    }

    function parseExpr() {
      let value = parseTerm();
      while (peek() === "+" || peek() === "-") {
        const op = src[pos++];
        const rhs = parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      }
      return value;
    }

    function parseTerm() {
      let value = parsePower();
      while (peek() === "*" || peek() === "/") {
        const op = src[pos++];
        const rhs = parsePower();
        if (op === "/") {
          if (rhs === 0) error("Division by zero");
          value = value / rhs;
        } else {
          value = value * rhs;
        }
      }
      return value;
    }

    function parsePower() {
      let value = parseUnary();
      if (peek() === "^") {
        pos++;
        const rhs = parsePower(); // right-associative
        value = Math.pow(value, rhs);
      }
      return value;
    }

    function parseUnary() {
      if (peek() === "-") {
        pos++;
        return -parseUnary();
      }
      if (peek() === "+") {
        pos++;
        return parseUnary();
      }
      return parsePostfix();
    }

    function parsePostfix() {
      let value = parsePrimary();
      while (peek() === "!" || peek() === "%") {
        if (peek() === "!") {
          pos++;
          value = factorial(value);
        } else if (peek() === "%") {
          pos++;
          value = value / 100;
        }
      }
      return value;
    }

    const FUNCS = ["sin", "cos", "tan", "log", "ln", "sqrt"];

    function matchFunc() {
      for (const f of FUNCS) {
        if (src.startsWith(f, pos)) return f;
      }
      return null;
    }

    function parsePrimary() {
      // parentheses
      if (peek() === "(") {
        pos++;
        const value = parseExpr();
        if (peek() !== ")") error("Missing closing parenthesis");
        pos++;
        return value;
      }

      // constants
      if (src.startsWith("pi", pos)) {
        pos += 2;
        return Math.PI;
      }
      if (peek() === "e" && !/[a-zA-Z]/.test(src[pos + 1] || "")) {
        pos += 1;
        return Math.E;
      }

      // functions
      const fn = matchFunc();
      if (fn) {
        pos += fn.length;
        if (peek() !== "(") error("Expected '(' after " + fn);
        pos++;
        const arg = parseExpr();
        if (peek() !== ")") error("Missing closing parenthesis");
        pos++;
        return applyFunc(fn, arg);
      }

      // numbers
      const start = pos;
      while (/[0-9.]/.test(peek() || "")) pos++;
      if (pos === start) error("Unexpected character: " + peek());
      const numStr = src.slice(start, pos);
      const num = parseFloat(numStr);
      if (Number.isNaN(num)) error("Invalid number: " + numStr);
      return num;
    }

    function applyFunc(fn, arg) {
      const rad = angleMode === "DEG" ? (arg * Math.PI) / 180 : arg;
      switch (fn) {
        case "sin": return Math.sin(rad);
        case "cos": return Math.cos(rad);
        case "tan": return Math.tan(rad);
        case "log": return Math.log10(arg);
        case "ln": return Math.log(arg);
        case "sqrt":
          if (arg < 0) error("Cannot take sqrt of a negative number");
          return Math.sqrt(arg);
        default: error("Unknown function: " + fn);
      }
    }

    function factorial(n) {
      if (n < 0 || !Number.isInteger(n)) error("Factorial requires a non-negative integer");
      let result = 1;
      for (let i = 2; i <= n; i++) result *= i;
      return result;
    }

    if (src.trim() === "") return 0;
    const result = parseExpr();
    if (pos < src.length) error("Unexpected character: " + src[pos]);
    return result;
  }

  function formatResult(num) {
    if (!Number.isFinite(num)) return "Error";
    // Round tiny floating point noise
    const rounded = Math.round(num * 1e10) / 1e10;
    return String(rounded);
  }

  // ---------- Actions ----------

  function doEquals() {
    try {
      const result = evaluateExpression(expression);
      expressionEl.textContent = expression + " =";
      expression = formatResult(result);
      justEvaluated = true;
      render();
    } catch (err) {
      displayEl.value = "Error";
      justEvaluated = true;
      expression = "";
    }
  }

  function toggleSign() {
    // Toggle sign of the trailing number in the expression
    const match = expression.match(/(\d+\.?\d*)$/);
    if (!match) return;
    const numStr = match[1];
    const idx = match.index;
    const before = expression.slice(0, idx);
    if (before.endsWith("(-") ) {
      expression = before.slice(0, -2) + numStr;
    } else if (before.endsWith("-") && !/[0-9)]$/.test(before.slice(0, -1))) {
      expression = before.slice(0, -1) + numStr;
    } else {
      expression = before + "(-" + numStr + ")";
    }
    render();
  }

  async function serverEval() {
    if (expression.trim() === "") return;
    serverStatusEl.textContent = "Calculating on server…";
    serverStatusEl.className = "";
    try {
      const res = await fetch("calculate.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "expression=" + encodeURIComponent(expression) + "&angleMode=" + angleMode,
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
    } catch (err) {
      serverStatusEl.textContent = "Server unreachable";
      serverStatusEl.className = "error";
    }
  }

  // ---------- Event wiring ----------

  document.querySelectorAll(".btn[data-value]").forEach((btn) => {
    btn.addEventListener("click", () => append(btn.dataset.value));
  });

  document.querySelectorAll(".btn[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      switch (action) {
        case "clear-all": clearAll(); break;
        case "clear-entry": clearEntry(); break;
        case "backspace": backspace(); break;
        case "equals": doEquals(); break;
        case "sin": append("sin("); break;
        case "cos": append("cos("); break;
        case "tan": append("tan("); break;
        case "log": append("log("); break;
        case "ln": append("ln("); break;
        case "sqrt": append("sqrt("); break;
        case "square": append("^2"); break;
        case "power": append("^"); break;
        case "factorial": append("!"); break;
        case "inverse":
          expression = "1/(" + (expression || "0") + ")";
          render();
          break;
        case "pi": append("π"); break;
        case "e": append("e"); break;
        case "percent": append("%"); break;
        case "plusminus": toggleSign(); break;
        case "server-eval": serverEval(); break;
        default: break;
      }
    });
  });

  degRadBtn.addEventListener("click", () => {
    angleMode = angleMode === "DEG" ? "RAD" : "DEG";
    degRadBtn.textContent = angleMode;
  });

  // Keyboard support
  document.addEventListener("keydown", (e) => {
    const key = e.key;
    if (/[0-9.]/.test(key)) { append(key); return; }
    if (["+", "-", "*", "/", "^", "(", ")"].includes(key)) { append(key); return; }
    if (key === "Enter" || key === "=") { e.preventDefault(); doEquals(); return; }
    if (key === "Backspace") { backspace(); return; }
    if (key === "Escape") { clearAll(); return; }
  });

  render();
})();