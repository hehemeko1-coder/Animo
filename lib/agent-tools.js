"use strict";

function safeCalculate(expression) {
  if (typeof expression !== "string" || expression.length > 120 || !/^[0-9+\-*/%.()\s]+$/.test(expression)) {
    return { error: "Only basic arithmetic characters are allowed." };
  }

  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/%]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s/g, "")) {
    return { error: "Invalid arithmetic expression." };
  }

  let index = 0;
  const primary = () => {
    const token = tokens[index++];
    if (token === "(") {
      const value = sum();
      if (tokens[index++] !== ")") throw new Error("Missing closing parenthesis.");
      return value;
    }
    if (token === "+" || token === "-") {
      const value = primary();
      return token === "-" ? -value : value;
    }
    if (token === undefined || token === ")") throw new Error("Expected a number.");
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Invalid number.");
    return value;
  };
  const product = () => {
    let value = primary();
    while (["*", "/", "%"].includes(tokens[index])) {
      const op = tokens[index++];
      const right = primary();
      if ((op === "/" || op === "%") && right === 0) throw new Error("Division by zero.");
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (["+", "-"].includes(tokens[index])) {
      const op = tokens[index++];
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };

  try {
    const result = sum();
    if (index !== tokens.length || !Number.isFinite(result)) {
      return { error: "Expression is invalid or result is not finite." };
    }
    return { result };
  } catch (error) {
    return { error: error.message || "Could not calculate expression." };
  }
}

function shouldForceCalculator(prompt) {
  if (typeof prompt !== "string" || prompt.length > 500 || !/\\d/.test(prompt)) return false;

  if (/\\b(calculate|compute|solve|multiply|arithmetic)\\b/i.test(prompt) &&
      (/[+*×÷\\-/]/.test(prompt) || /\\b(times|multiplied by|plus|minus|divided by)\\b/i.test(prompt) ||
       /\\bpercent(?:age)?\\b/i.test(prompt))) return true;

  let expression = prompt.trim()
    .replace(/^(?:(?:what is|what's|how much is|evaluate)\\s+)/i, "")
    .replace(/[?=]$/, "")
    .trim();
  if (!/^[0-9+\\-*/%.()\\s]+$/.test(expression)) return false;
  if (!/[+*/%]/.test(expression) && !/\\d\\s*-\\s*\\d/.test(expression)) return false;
  if ((expression.match(/-/g) || []).length >= 2 && !/[+*/%()]/.test(expression)) return false;
  return true;
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
