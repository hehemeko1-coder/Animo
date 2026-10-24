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
  const allowed = /^(?:\d+(?:\.\d*)?|\.\d+|[A-Za-z]+|[()+\-*/%^!,\s])+$/;
  if (!source || !allowed.test(source)) {
    return { error: "Expression contains unsupported characters." };
  }

  const tokens = source.match(/\d+(?:\.\d*)?|\.\d+|[A-Za-z]+|[()+\-*/%^!,]/g);
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
    if (peek() === "^" || peek() === "%") {
      const op = take();
      const exponent = unary();
      if (op === "^") {
        if (Math.abs(exponent) > 1000) throw new Error("Exponent magnitude must be 1000 or less.");
        if (base === 0 && exponent < 0) throw new Error("Zero cannot be raised to a negative power.");
        return ensureFinite(base ** exponent);
      }
      if (exponent === 0) throw new Error("Modulo by zero.");
      return ensureFinite(base % exponent);
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
    while (["*", "/"].includes(peek())) {
      const op = take();
      const right = unary();
      if (op === "/" && right === 0) throw new Error("Division by zero.");
      value = ensureFinite(op === "*" ? value * right : value / right);
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

module.exports = { safeCalculate, shouldForceCalculator, normalizeFirecrawlResults };
