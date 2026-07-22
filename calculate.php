<?php
/**
 * calculate.php — Server-side expression evaluator for the Scientific Calculator.
 *
 * Receives an expression string (built by the JS front-end) via POST and
 * evaluates it using a hand-written recursive-descent parser. No eval() is
 * used anywhere, so arbitrary code cannot be injected through the input.
 *
 * POST params:
 *   expression  string  e.g. "12+sin(30)*2^3"
 *   angleMode   string  "DEG" or "RAD" (affects sin/cos/tan)
 *
 * Response (JSON):
 *   { "success": true,  "result": 42.5 }
 *   { "success": false, "error": "Division by zero" }
 */

header("Content-Type: application/json");

class CalculatorParseException extends Exception {}

class ExpressionParser
{
    private string $src;
    private int $pos = 0;
    private int $len;
    private string $angleMode;

    private const FUNCTIONS = ["sin", "cos", "tan", "log", "ln", "sqrt"];

    public function __construct(string $expression, string $angleMode = "DEG")
    {
        // Normalize symbols coming from the UI
        $expression = str_replace(["π", "×", "÷"], ["pi", "*", "/"], $expression);
        // Whitelist allowed characters only — anything else is rejected outright.
        if (!preg_match('/^[0-9a-zA-Z.+\-*\/^!%()\s]*$/', $expression)) {
            throw new CalculatorParseException("Expression contains invalid characters");
        }
        $this->src = $expression;
        $this->len = strlen($expression);
        $this->angleMode = strtoupper($angleMode) === "RAD" ? "RAD" : "DEG";
    }

    public function evaluate(): float
    {
        if (trim($this->src) === "") {
            return 0.0;
        }
        $this->skipSpaces();
        $value = $this->parseExpr();
        $this->skipSpaces();
        if ($this->pos < $this->len) {
            throw new CalculatorParseException("Unexpected character near position {$this->pos}");
        }
        return $value;
    }

    private function skipSpaces(): void
    {
        while ($this->pos < $this->len && ctype_space($this->src[$this->pos])) {
            $this->pos++;
        }
    }

    private function peek(): ?string
    {
        return $this->pos < $this->len ? $this->src[$this->pos] : null;
    }

    private function parseExpr(): float
    {
        $value = $this->parseTerm();
        $this->skipSpaces();
        while (in_array($this->peek(), ["+", "-"], true)) {
            $op = $this->src[$this->pos++];
            $this->skipSpaces();
            $rhs = $this->parseTerm();
            $value = $op === "+" ? $value + $rhs : $value - $rhs;
            $this->skipSpaces();
        }
        return $value;
    }

    private function parseTerm(): float
    {
        $value = $this->parsePower();
        $this->skipSpaces();
        while (in_array($this->peek(), ["*", "/"], true)) {
            $op = $this->src[$this->pos++];
            $this->skipSpaces();
            $rhs = $this->parsePower();
            if ($op === "/") {
                if ($rhs == 0) {
                    throw new CalculatorParseException("Division by zero");
                }
                $value = $value / $rhs;
            } else {
                $value = $value * $rhs;
            }
            $this->skipSpaces();
        }
        return $value;
    }

    private function parsePower(): float
    {
        $value = $this->parseUnary();
        $this->skipSpaces();
        if ($this->peek() === "^") {
            $this->pos++;
            $this->skipSpaces();
            $rhs = $this->parsePower(); // right-associative
            $value = pow($value, $rhs);
        }
        return $value;
    }

    private function parseUnary(): float
    {
        $this->skipSpaces();
        if ($this->peek() === "-") {
            $this->pos++;
            $this->skipSpaces();
            return -$this->parseUnary();
        }
        if ($this->peek() === "+") {
            $this->pos++;
            $this->skipSpaces();
            return $this->parseUnary();
        }
        return $this->parsePostfix();
    }

    private function parsePostfix(): float
    {
        $value = $this->parsePrimary();
        $this->skipSpaces();
        while (in_array($this->peek(), ["!", "%"], true)) {
            if ($this->peek() === "!") {
                $this->pos++;
                $value = $this->factorial($value);
            } else {
                $this->pos++;
                $value = $value / 100;
            }
            $this->skipSpaces();
        }
        return $value;
    }

    private function matchFunc(): ?string
    {
        foreach (self::FUNCTIONS as $fn) {
            if (substr($this->src, $this->pos, strlen($fn)) === $fn) {
                return $fn;
            }
        }
        return null;
    }

    private function parsePrimary(): float
    {
        $this->skipSpaces();

        if ($this->peek() === "(") {
            $this->pos++;
            $value = $this->parseExpr();
            $this->skipSpaces();
            if ($this->peek() !== ")") {
                throw new CalculatorParseException("Missing closing parenthesis");
            }
            $this->pos++;
            return $value;
        }

        if (substr($this->src, $this->pos, 2) === "pi") {
            $this->pos += 2;
            return M_PI;
        }

        if ($this->peek() === "e" && !ctype_alpha($this->src[$this->pos + 1] ?? "")) {
            $this->pos += 1;
            return M_E;
        }

        $fn = $this->matchFunc();
        if ($fn !== null) {
            $this->pos += strlen($fn);
            $this->skipSpaces();
            if ($this->peek() !== "(") {
                throw new CalculatorParseException("Expected '(' after {$fn}");
            }
            $this->pos++;
            $arg = $this->parseExpr();
            $this->skipSpaces();
            if ($this->peek() !== ")") {
                throw new CalculatorParseException("Missing closing parenthesis");
            }
            $this->pos++;
            return $this->applyFunc($fn, $arg);
        }

        $start = $this->pos;
        while ($this->pos < $this->len && (ctype_digit($this->src[$this->pos]) || $this->src[$this->pos] === ".")) {
            $this->pos++;
        }
        if ($this->pos === $start) {
            throw new CalculatorParseException("Unexpected character: " . ($this->peek() ?? "end of input"));
        }
        $numStr = substr($this->src, $start, $this->pos - $start);
        if (!is_numeric($numStr)) {
            throw new CalculatorParseException("Invalid number: {$numStr}");
        }
        return (float) $numStr;
    }

    private function applyFunc(string $fn, float $arg): float
    {
        $rad = $this->angleMode === "DEG" ? deg2rad($arg) : $arg;
        switch ($fn) {
            case "sin":  return sin($rad);
            case "cos":  return cos($rad);
            case "tan":  return tan($rad);
            case "log":  return log10($arg);
            case "ln":   return log($arg);
            case "sqrt":
                if ($arg < 0) {
                    throw new CalculatorParseException("Cannot take sqrt of a negative number");
                }
                return sqrt($arg);
            default:
                throw new CalculatorParseException("Unknown function: {$fn}");
        }
    }

    private function factorial(float $n): float
    {
        if ($n < 0 || floor($n) != $n) {
            throw new CalculatorParseException("Factorial requires a non-negative integer");
        }
        $result = 1.0;
        for ($i = 2; $i <= $n; $i++) {
            $result *= $i;
        }
        return $result;
    }
}

// ---------- Request handling ----------

$expression = $_POST["expression"] ?? "";
$angleMode  = $_POST["angleMode"] ?? "DEG";

if (!is_string($expression) || trim($expression) === "") {
    echo json_encode(["success" => false, "error" => "No expression provided"]);
    exit;
}

try {
    $parser = new ExpressionParser($expression, $angleMode);
    $result = $parser->evaluate();

    if (!is_finite($result)) {
        throw new CalculatorParseException("Result is not a finite number");
    }

    // Round tiny floating point noise
    $result = round($result, 10);

    echo json_encode(["success" => true, "result" => $result]);
} catch (CalculatorParseException $e) {
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
} catch (Throwable $e) {
    echo json_encode(["success" => false, "error" => "Unexpected error"]);
}