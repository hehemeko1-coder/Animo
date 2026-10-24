"use strict";

const MATH_FUNCTIONS = Object.freeze({
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round
});
const MATH_CONSTANTS = Object.freeze({ pi: Math.PI, e: Math.E });

function safeCalculate(expression) {
  if (typeof expression !== "string" || expression.length > 120) {
    return { error: "Enter a math expression of at most 120 characters." };
  }

  const source = expression.replace(/×/g, "*").replace(/÷/g, "/").trim();
  const allowed = /^(?:\d+(?:\.\d*)?|\.\d+|[A-Za-z]+|[()+\-*\x2f%^ \t\r\n])+$/;
  if (!source || !allowed.test(source)) {
    return { error: "Expression contains unsupported characters." };
  }

  const tokens = source.match(/\d+(?:\.\d*)?|\.\d+|[A-Za-z]+|[()+\-*\x2f%^]/g);
  if (!tokens || tokens.join("").replace(/,/g, "") !== source.replace(/\s/g, "").replace(/,/g, "")) {
    return { error: "Invalid math expression." };
  }

  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = (token) => {
    if (take() !== token) throw new Error("Expected '" + token + "'.");
  };
  const ensureFinite = (value) => {
    if (!Number.isFinite(value)) throw new Error("The result is undefined or outside the supported numeric range.");
    return value;
  };

  const primary = () => {
    const token = take();
    if (token === "(") {
      const value = sum();
      expect(")");
      return value;
    }
    if (token === undefined) throw new Error("Expected a number or function.");
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return Number(token);
    const name = token.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MATH_CONSTANTS, name)) return MATH_CONSTANTS[name];
    if (Object.prototype.hasOwnProperty.call(MATH_FUNCTIONS, name)) {
      expect("(");
      const argument = sum();
      expect(")");
      if (name === "sqrt" && argument < 0) throw new Error("Square root of a negative number is not supported in real-number mode.");
      if ((name === "ln" || name === "log" || name === "log10") && argument <= 0) throw new Error("Logarithms require a positive input.");
      return ensureFinite(MATH_FUNCTIONS[name](argument));
    }
    throw new Error("Unknown function or constant: " + token + ".");
  };

  const power = () => {
    const base = primary();
    if (peek() === "^") {
      const op = take();
      const exponent = unary();
      if (Math.abs(exponent) > 1000) throw new Error("Exponent magnitude must be 1000 or less.");
      if (base === 0 && exponent < 0) throw new Error("Zero cannot be raised to a negative power.");
      return ensureFinite(base ** exponent);
    }
    return base;
  };
  const unary = () => {
    if (peek() === "+") { take(); return unary(); }
    if (peek() === "-") { take(); return -unary(); }
    return power();
  };
  const product = () => {
    let value = unary();
    while (["*", "/", "%"].includes(peek())) {
      const op = take();
      const right = unary();
      if ((op === "/" || op === "%") && right === 0) throw new Error(op === "/" ? "Division by zero." : "Modulo by zero.");
      value = ensureFinite(op === "*" ? value * right : op === "/" ? value / right : value % right);
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (["+", "-"].includes(peek())) {
      const op = take();
      const right = product();
      value = ensureFinite(op === "+" ? value + right : value - right);
    }
    return value;
  };

  try {
    const result = sum();
    if (index !== tokens.length) return { error: "Unexpected token: " + peek() + "." };
    return { result: ensureFinite(result) };
  } catch (error) {
    return { error: error.message || "Could not calculate expression." };
  }
}


function solveLinearEquation(equation) {
  if (typeof equation !== "string" || equation.length > 120) {
    return { error: "Enter a linear equation of at most 120 characters." };
  }
  const source = equation.replace(/×/g, "*").replace(/÷/g, "/").trim();
  const parts = source.split("=");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    return { error: "Enter one equation with exactly one equals sign." };
  }
  const sides = parts.map(part => part.trim());
  if (!sides.some(part => /x/i.test(part))) {
    return { error: "Include the variable x in the equation." };
  }
  const evaluateAt = (expression, x) => {
    const substituted = expression.replace(/(\d|\))\s*x\b/gi, "$1*(" + x + ")").replace(/\bx\b/gi, "(" + x + ")");
    return safeCalculate(substituted);
  };
  const affine = expression => {
    const at0 = evaluateAt(expression, 0);
    const at1 = evaluateAt(expression, 1);
    const at2 = evaluateAt(expression, 2);
    if (at0.error || at1.error || at2.error) throw new Error(at0.error || at1.error || at2.error);
    const b = at0.result;
    const a = at1.result - b;
    if (Math.abs((at2.result - b) - 2 * a) > 1e-9 * Math.max(1, Math.abs(at2.result), Math.abs(b))) {
      throw new Error("This solver currently supports linear equations only (no x², x in denominators, or nonlinear functions of x).");
    }
    return { a, b };
  };
  try {
    const left = affine(sides[0]);
    const right = affine(sides[1]);
    const coefficient = left.a - right.a;
    const constant = right.b - left.b;
    if (Math.abs(coefficient) < 1e-12) {
      return Math.abs(constant) < 1e-12
        ? { result: "all real numbers", explanation: "Both sides simplify to the same expression, so every real x is a solution." }
        : { error: "This equation has no solution because the variable terms cancel but the constants differ." };
    }
    const x = constant / coefficient;
    if (!Number.isFinite(x)) return { error: "The solution is outside the supported numeric range." };
    const checkLeft = evaluateAt(sides[0], x);
    const checkRight = evaluateAt(sides[1], x);
    if (checkLeft.error || checkRight.error || Math.abs(checkLeft.result - checkRight.result) > 1e-7 * Math.max(1, Math.abs(checkLeft.result), Math.abs(checkRight.result))) {
      return { error: "Could not verify the candidate solution in the original equation." };
    }
    return {
      result: x,
      steps: [
        "Collect the x terms: (" + left.a + ")x + (" + left.b + ") = (" + right.a + ")x + (" + right.b + ").",
        "Move x terms to the left and constants to the right: (" + coefficient + ")x = " + constant + ".",
        "Divide both sides by " + coefficient + ": x = " + x + ".",
        "Check: substituting x = " + x + " gives " + checkLeft.result + " on the left and " + checkRight.result + " on the right."
      ]
    };
  } catch (error) {
    return { error: error.message || "Could not solve this equation." };
  }
}

function solveQuadraticEquation(equation) {
  if (typeof equation !== "string" || equation.length > 120) {
    return { error: "Enter an equation of at most 120 characters." };
  }
  const parts = equation.replace(/×/g, "*").replace(/÷/g, "/").trim().split("=");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    return { error: "Enter one equation with exactly one equals sign." };
  }
  const sides = parts.map(part => part.trim());
  if (!sides.some(part => /x/i.test(part))) return { error: "Include the variable x in the equation." };
  const evaluateAt = (expression, x) => {
    const substituted = expression.replace(/(\d|\))\s*x\b/gi, "$1*(" + x + ")").replace(/\bx\b/gi, "(" + x + ")");
    return safeCalculate(substituted);
  };
  try {
    const coefficients = expression => {
      const values = [0, 1, -1, 2].map(x => evaluateAt(expression, x));
      const failed = values.find(value => value.error);
      if (failed) throw new Error(failed.error);
      const c = values[0].result;
      const a = (values[1].result + values[2].result - 2 * c) / 2;
      const b = (values[1].result - values[2].result) / 2;
      const predicted = a * 4 + b * 2 + c;
      if (Math.abs(predicted - values[3].result) > 1e-8 * Math.max(1, Math.abs(predicted), Math.abs(values[3].result))) {
        throw new Error("This solver supports polynomial equations up to degree 2 only.");
      }
      return { a, b, c };
    };
    const left = coefficients(sides[0]);
    const right = coefficients(sides[1]);
    const a = left.a - right.a;
    const b = left.b - right.b;
    const c = left.c - right.c;
    const scale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c));
    if (Math.abs(a) <= 1e-12 * scale) {
      return solveLinearEquation(equation);
    }
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -1e-12 * Math.max(1, b * b, Math.abs(4 * a * c))) {
      return { error: "This quadratic has no real solutions. Complex-number solutions are not supported yet." };
    }
    const d = Math.max(0, discriminant);
    const root1 = (-b + Math.sqrt(d)) / (2 * a);
    const root2 = (-b - Math.sqrt(d)) / (2 * a);
    const roots = Math.abs(root1 - root2) < 1e-10 * Math.max(1, Math.abs(root1), Math.abs(root2)) ? [root1] : [root1, root2];
    for (const x of roots) {
      const l = evaluateAt(sides[0], x);
      const r = evaluateAt(sides[1], x);
      if (l.error || r.error || Math.abs(l.result - r.result) > 1e-7 * Math.max(1, Math.abs(l.result), Math.abs(r.result))) {
        return { error: "Could not verify the candidate roots in the original equation." };
      }
    }
    return {
      result: roots.length === 1 ? roots[0] : roots,
      roots,
      steps: [
        "Rewrite the equation in standard form ax² + bx + c = 0.",
        "Subtract the right side from the left: (" + a + ")x² + (" + b + ")x + (" + c + ") = 0.",
        "Calculate the discriminant: b² − 4ac = " + discriminant + ".",
        "Use x = (−b ± √(b² − 4ac)) / (2a).",
        "Real solution" + (roots.length === 1 ? "" : "s") + ": " + roots.map(x => "x = " + x).join(", ") + ". Substitution checks passed."
      ]
    };
  } catch (error) {
    return { error: error.message || "Could not solve this equation." };
  }
}



function solveLinearInequality(input) {
  if (typeof input !== "string" || input.length > 120) return { error: "Enter one linear inequality in x." };
  const match = input.trim().match(/^(.+?)(<=|>=|<|>)(.+)$/);
  if (!match || !/x/i.test(input)) return { error: "Use one inequality such as 2x + 3 < 11." };
  const [, leftExpr, operator, rightExpr] = match;
  const evaluate = (expression, x) => {
    const substituted = expression
      .replace(/(\d|\))\s*x\b/gi, "$1*(" + x + ")")
      .replace(/\bx\b/gi, "(" + x + ")");
    return safeCalculate(substituted);
  };
  try {
    const difference = x => {
      const left = evaluate(leftExpr.trim(), x);
      const right = evaluate(rightExpr.trim(), x);
      if (left.error || right.error) throw new Error(left.error || right.error);
      return left.result - right.result;
    };
    const c = difference(0);
    const a = difference(1) - c;
    const check = difference(2);
    if (Math.abs(check - (2 * a + c)) > 1e-8 * Math.max(1, Math.abs(check), Math.abs(a), Math.abs(c))) {
      throw new Error("Only linear inequalities in x are supported.");
    }
    const inclusive = operator === "<=" || operator === ">=";
    const wantPositive = operator === ">" || operator === ">=";
    if (Math.abs(a) < 1e-12) {
      const trueCondition = wantPositive
        ? (inclusive ? c >= 0 : c > 0)
        : (inclusive ? c <= 0 : c < 0);
      return {
        result: trueCondition ? "all real numbers" : "no solution",
        interval: trueCondition ? "(-∞, ∞)" : "∅",
        steps: ["Subtract the right side from the left to get " + c + " " + operator + " 0.", "The variable terms cancel, so the inequality is " + (trueCondition ? "always true." : "never true.")]
      };
    }
    const boundary = -c / a;
    const greater = wantPositive === (a > 0);
    const symbol = greater ? (inclusive ? "≥" : ">") : (inclusive ? "≤" : "<");
    const result = "x " + symbol + " " + boundary;
    const interval = greater
      ? (inclusive ? "[" : "(") + boundary + ", ∞)"
      : "(-∞, " + boundary + (inclusive ? "]" : ")");
    return {
      result,
      interval,
      boundary,
      steps: [
        "Move all terms to the left: (" + a + ")x + (" + c + ") " + operator + " 0.",
        "Subtract the constant and divide by the coefficient of x.",
        (a < 0 ? "Because the coefficient is negative, reverse the inequality sign when dividing." : "The coefficient is positive, so the inequality direction stays the same."),
        "Solution: " + result + ", or interval notation " + interval + "."
      ]
    };
  } catch (error) {
    return { error: error.message || "Could not solve this inequality." };
  }
}

function solveLinearSystem(input) {
  const equations = Array.isArray(input)
    ? input
    : typeof input === "string" ? input.split(/[;\n]+/).map(part => part.trim()).filter(Boolean) : [];
  if (equations.length !== 2 || equations.some(eq => typeof eq !== "string" || eq.length > 120)) {
    return { error: "Enter exactly two linear equations, separated by a new line or semicolon." };
  }
  const parsed = equations.map(equation => equation.replace(/×/g, "*").replace(/÷/g, "/").split("="));
  if (parsed.some(parts => parts.length !== 2 || !parts[0].trim() || !parts[1].trim())) {
    return { error: "Each equation must contain exactly one equals sign." };
  }
  if (!equations.some(eq => /x/i.test(eq)) || !equations.some(eq => /y/i.test(eq))) {
    return { error: "Include both variables x and y across the two equations." };
  }
  const evaluate = (expression, x, y) => {
    const substituted = expression
      .replace(/(\d|\))\s*x\b/gi, "$1*(" + x + ")")
      .replace(/(\d|\))\s*y\b/gi, "$1*(" + y + ")")
      .replace(/\bx\b/gi, "(" + x + ")")
      .replace(/\by\b/gi, "(" + y + ")");
    return safeCalculate(substituted);
  };
  try {
    const coefficients = (leftExpr, rightExpr) => {
      const difference = (x, y) => {
        const left = evaluate(leftExpr, x, y);
        const right = evaluate(rightExpr, x, y);
        if (left.error || right.error) throw new Error(left.error || right.error);
        return left.result - right.result;
      };
      const c = difference(0, 0);
      const a = difference(1, 0) - c;
      const b = difference(0, 1) - c;
      const check = difference(2, 3);
      if (Math.abs(check - (2 * a + 3 * b + c)) > 1e-8 * Math.max(1, Math.abs(check), Math.abs(a), Math.abs(b), Math.abs(c))) {
        throw new Error("Only linear equations in x and y are supported.");
      }
      return { a, b, c };
    };
    const rows = parsed.map(parts => coefficients(parts[0].trim(), parts[1].trim()));
    const [first, second] = rows;
    const determinant = first.a * second.b - second.a * first.b;
    const scale = Math.max(1, Math.abs(first.a), Math.abs(first.b), Math.abs(second.a), Math.abs(second.b));
    if (Math.abs(determinant) <= 1e-12 * scale * scale) {
      const proportional = Math.abs(first.a * second.c - second.a * first.c) <= 1e-10 * scale &&
        Math.abs(first.b * second.c - second.b * first.c) <= 1e-10 * scale;
      return { error: proportional ? "These equations do not determine a unique solution (they may describe the same line)." : "These equations are inconsistent and have no solution." };
    }
    const x = (-first.c * second.b + second.c * first.b) / determinant;
    const y = (-first.a * second.c + second.a * first.c) / determinant;
    for (let i = 0; i < parsed.length; i++) {
      const left = evaluate(parsed[i][0].trim(), x, y);
      const right = evaluate(parsed[i][1].trim(), x, y);
      if (left.error || right.error || Math.abs(left.result - right.result) > 1e-7 * Math.max(1, Math.abs(left.result), Math.abs(right.result))) {
        return { error: "Could not verify the candidate solution in the original equations." };
      }
    }
    return {
      result: { x, y },
      steps: [
        "Write each equation in the form ax + by = c.",
        "Equation 1 coefficients: (" + first.a + ")x + (" + first.b + ")y = " + (-first.c) + ".",
        "Equation 2 coefficients: (" + second.a + ")x + (" + second.b + ")y = " + (-second.c) + ".",
        "Solve the two equations simultaneously using elimination or determinants.",
        "Check: x = " + x + ", y = " + y + " satisfies both original equations."
      ]
    };
  } catch (error) {
    return { error: error.message || "Could not solve this system." };
  }
}

function shouldForceCalculator(prompt) {
  if (typeof prompt !== "string" || prompt.length > 500 || !/\d/.test(prompt)) return false;
  const normalized = prompt.trim()
    .replace(/^(?:(?:calculate|compute|solve|evaluate|what is|what's|how much is)\s+)/i, "")
    .replace(/[?=]$/, "")
    .trim();
  if (/^(?:sqrt|abs|sin|cos|tan|asin|acos|atan|ln|log|log10|exp|floor|ceil|round)\s*\(/i.test(normalized)) {
    return !safeCalculate(normalized).error;
  }
  if (/^[0-9+*/%^().\s-]+$/.test(normalized)) {
    return /[+*/%^]/.test(normalized) || /\d\s*-\s*\d/.test(normalized);
  }
  if (/\b(calculate|compute|solve|evaluate)\b/i.test(prompt) &&
      /\b(sqrt|square root|power|raised to|sin|cos|tan|logarithm|log|ln)\b/i.test(prompt)) return true;
  if (/\b(calculate|compute|solve|multiply|arithmetic)\b/i.test(prompt) &&
      (/[+*×÷\/-]/.test(prompt) || /\b(times|multiplied by|plus|minus|divided by)\b/i.test(prompt))) return true;
  return false;
}


function solvePercentageProblem(prompt) {
  if (typeof prompt !== "string" || prompt.length > 300) return null;
  const text = prompt.toLowerCase().replace(/,/g, "").replace(/\\s+/g, " ").trim();
  const number = "(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
  const match = (pattern) => text.match(new RegExp(pattern, "i"));
  const finite = (value) => Number.isFinite(value) ? value : null;
  const format = (value) => Number(value.toPrecision(12)).toString();
  let m;

  m = match("^(?:(?:please )?(?:calculate|compute|find|what is|what's|how much is) )?(" + number + ")\\s*(?:%|percent)\\s+of\\s+(" + number + ")[?!. ]*$");
  if (m) {
    const percent = Number(m[1]), base = Number(m[2]), value = finite(base * percent / 100);
    if (value === null) return { error: "The percentage result is outside the supported numeric range." };
    return { result: value, steps: [format(percent) + "% means " + format(percent) + " ÷ 100 = " + format(percent / 100) + ".", "Multiply the base by the decimal: " + format(base) + " × " + format(percent / 100) + " = " + format(value) + "."] };
  }

  m = match("^(?:(?:please )?(?:calculate|compute|find) )?(?:increase|raise|increase the value of) (" + number + ") by (" + number + ")\\s*(?:%|percent)[?!. ]*$");
  if (m) {
    const base = Number(m[1]), percent = Number(m[2]), change = finite(base * percent / 100);
    if (change === null || finite(base + change) === null) return { error: "The percentage result is outside the supported numeric range." };
    return { result: base + change, steps: ["Find the increase: " + format(base) + " × " + format(percent) + " ÷ 100 = " + format(change) + ".", "Add it to the original value: " + format(base) + " + " + format(change) + " = " + format(base + change) + "."] };
  }
  m = match("^(?:(?:please )?(?:calculate|compute|find) )?(?:decrease|reduce|discount) (" + number + ") by (" + number + ")\\s*(?:%|percent)[?!. ]*$");
  if (m) {
    const base = Number(m[1]), percent = Number(m[2]), change = finite(base * percent / 100);
    if (change === null || finite(base - change) === null) return { error: "The percentage result is outside the supported numeric range." };
    return { result: base - change, steps: ["Find the decrease: " + format(base) + " × " + format(percent) + " ÷ 100 = " + format(change) + ".", "Subtract it from the original value: " + format(base) + " − " + format(change) + " = " + format(base - change) + "."] };
  }
  m = match("^(?:(?:please )?(?:calculate|compute|find) )?discount (" + number + ")\\s*(?:%|percent) from (" + number + ")[?!. ]*$");
  if (m) {
    const percent = Number(m[1]), base = Number(m[2]), discount = finite(base * percent / 100);
    if (discount === null || finite(base - discount) === null) return { error: "The percentage result is outside the supported numeric range." };
    return { result: base - discount, steps: ["Discount amount: " + format(base) + " × " + format(percent) + " ÷ 100 = " + format(discount) + ".", "Subtract the discount: " + format(base) + " − " + format(discount) + " = " + format(base - discount) + "."] };
  }

  m = match("^(?:(?:please )?(?:calculate|compute|find|what percent is) )?(" + number + ")\\s+(?:is )?(?:what percent of|as a percent of|out of)\\s+(" + number + ")[?!. ]*$");
  if (m) {
    const part = Number(m[1]), whole = Number(m[2]);
    if (whole === 0) return { error: "Cannot calculate a percentage of a zero total." };
    const value = finite(part / whole * 100);
    if (value === null) return { error: "The percentage result is outside the supported numeric range." };
    return { result: value, steps: ["Divide the part by the total: " + format(part) + " ÷ " + format(whole) + " = " + format(part / whole) + ".", "Convert to a percentage: " + format(part / whole) + " × 100 = " + format(value) + "%."] };
  }
  return null;
}


function solveFractionExpression(prompt) {
  if (typeof prompt !== "string" || prompt.length > 120) return null;
  const text = prompt.trim().replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, " ");
  const match = text.match(/^(?:(?:please )?(?:calculate|compute|simplify|evaluate|what is|what's) )?(\\d{1,9})\\s*\\/\\s*(\\d{1,9})(?:\\s*([+*\\-])\\s*(\\d{1,9})\\s*\\/\\s*(\\d{1,9}))?[?!. ]*$/i);
  if (!match) return null;
  const a = Number(match[1]), b = Number(match[2]);
  const op = match[3] || null;
  const c = match[4] === undefined ? null : Number(match[4]);
  const d = match[5] === undefined ? null : Number(match[5]);
  if (b === 0 || (d !== null && d === 0)) return { error: "A fraction denominator cannot be zero." };
  const gcd = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y) { const t = y; y = x % y; x = t; } return x || 1; };
  const reduce = (n, den) => {
    if (den < 0) { n = -n; den = -den; }
    const g = gcd(n, den);
    return { n: n / g, d: den / g };
  };
  let n = a, den = b, steps = [];
  if (!op) {
    const r = reduce(n, den);
    steps.push("Divide the numerator and denominator by their greatest common divisor, " + gcd(a, b) + ".");
    return { result: r.d === 1 ? String(r.n) : r.n + "/" + r.d, numerator: r.n, denominator: r.d, steps };
  }
  let rawN, rawD;
  if (op === "+") { rawN = a * d + c * b; rawD = b * d; steps.push("Use a common denominator: " + a + "/" + b + " + " + c + "/" + d + " = " + (a*d) + "/" + rawD + " + " + (c*b) + "/" + rawD + "."); }
  else if (op === "-") { rawN = a * d - c * b; rawD = b * d; steps.push("Use a common denominator: " + a + "/" + b + " − " + c + "/" + d + " = " + (a*d) + "/" + rawD + " − " + (c*b) + "/" + rawD + "."); }
  else { rawN = a * c; rawD = b * d; steps.push("Multiply numerators and denominators: " + a + " × " + c + " = " + rawN + ", and " + b + " × " + d + " = " + rawD + "."); }
  if (![rawN, rawD].every(Number.isSafeInteger) || Math.abs(rawN) > 1e15 || rawD > 1e15) return { error: "These fractions are too large to calculate safely." };
  const r = reduce(rawN, rawD);
  steps.push("Simplify by dividing the numerator and denominator by " + gcd(rawN, rawD) + ": " + r.n + "/" + r.d + ".");
  return { result: r.d === 1 ? String(r.n) : r.n + "/" + r.d, numerator: r.n, denominator: r.d, steps };
}

function solveRatioProblem(prompt) {
  if (typeof prompt !== "string" || prompt.length > 250) return null;
  const text = prompt.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
  let m = text.match(/^(?:(?:please )?(?:simplify|reduce) )?(\d{1,9})\s*[:/]\s*(\d{1,9})[?!. ]*$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 0 && b === 0) return { error: "The ratio 0:0 is undefined." };
    const gcd = (x, y) => { while (y) { const t = y; y = x % y; x = t; } return x || 1; };
    const g = gcd(a, b);
    return { result: (a / g) + ":" + (b / g), steps: ["Find the greatest common divisor of " + a + " and " + b + ": " + g + ".", "Divide both parts by " + g + " to get " + (a/g) + ":" + (b/g) + "."] };
  }
  m = text.match(/^(?:if )?(\d+(?:\.\d+)?)\s+(?:items? )?(?:cost|costs|is|are)\s+(\d+(?:\.\d+)?)\s*(?:birr|dollars?|usd)?[,; ]+(?:how much (?:does|do|will)\s+)?(?:would )?(\d+(?:\.\d+)?)\s+(?:items? )?(?:cost|costs)?[?!. ]*$/);
  if (m) {
    const quantity1 = Number(m[1]), price1 = Number(m[2]), quantity2 = Number(m[3]);
    if (quantity1 === 0) return { error: "The starting quantity must be greater than zero." };
    const unitPrice = price1 / quantity1, answer = unitPrice * quantity2;
    if (!Number.isFinite(answer)) return { error: "The ratio result is outside the supported numeric range." };
    const fmt = n => Number(n.toPrecision(12)).toString();
    return { result: answer, steps: ["Find the unit cost: " + fmt(price1) + " ÷ " + fmt(quantity1) + " = " + fmt(unitPrice) + ".", "Scale to " + fmt(quantity2) + " items: " + fmt(unitPrice) + " × " + fmt(quantity2) + " = " + fmt(answer) + "."] };
  }
  return null;
}

function normalizeFirecrawlResults(data) {
  const payload = data && data.data;
  const items = Array.isArray(payload)
    ? payload
    : [
        ...(Array.isArray(payload && payload.web) ? payload.web : []),
        ...(Array.isArray(payload && payload.news) ? payload.news : [])
      ];

  return items.slice(0, 5).map(item => ({
    title: String(item.title || (item.metadata && item.metadata.title) || "Source").slice(0, 200),
    url: typeof item.url === "string" && /^https?:\/\//i.test(item.url)
      ? item.url
      : (typeof (item.metadata && item.metadata.sourceURL) === "string" && /^https?:\/\//i.test(item.metadata.sourceURL)
        ? item.metadata.sourceURL : ""),
    snippet: String(item.description || item.markdown || item.content || (item.metadata && item.metadata.description) || "").slice(0, 1400)
  })).filter(item => item.url);
}

module.exports = { safeCalculate, solveLinearEquation, solveQuadraticEquation, solveLinearSystem, solveLinearInequality, solvePercentageProblem, solveFractionExpression, solveRatioProblem, shouldForceCalculator, normalizeFirecrawlResults };
