"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { safeCalculate, shouldForceCalculator } = require("../lib/agent-tools.js");

function result(expression, expected, tolerance = 1e-10) {
  const actual = safeCalculate(expression);
  assert.equal(actual.error, undefined, actual.error);
  assert.ok(Math.abs(actual.result - expected) <= tolerance, expression + ": expected " + expected + ", got " + actual.result);
}

test("basic arithmetic and parentheses", () => {
  result("2 + 3 * 4", 14);
  result("(2 + 3) * 4", 20);
  result("10 / 4", 2.5);
  result("7 % 4", 3);
});

test("powers follow standard precedence and associate right-to-left", () => {
  result("2^3^2", 512);
  result("-2^2", -4);
  result("(-2)^2", 4);
  result("2^-3", 0.125);
});

test("constants and scientific functions", () => {
  result("pi", Math.PI);
  result("e", Math.E);
  result("sqrt(144)", 12);
  result("abs(-8)", 8);
  result("sin(pi/2)", 1);
  result("cos(0)", 1);
  result("ln(e)", 1);
  result("log(1000)", 3);
  result("round(2.6)", 3);
});

test("rejects invalid or unsafe math", () => {
  assert.ok(safeCalculate("1/0").error);
  assert.ok(safeCalculate("sqrt(-1)").error);
  assert.ok(safeCalculate("log(0)").error);
  assert.ok(safeCalculate("process.exit()").error);
  assert.ok(safeCalculate("2 +").error);
  assert.ok(safeCalculate("1e999").error || safeCalculate("1e999").result === undefined);
});

test("calculator intent detection", () => {
  assert.equal(shouldForceCalculator("Calculate sqrt(144)"), true);
  assert.equal(shouldForceCalculator("2 + 2"), true);
  assert.equal(shouldForceCalculator("Tell me a story about 2 dragons"), false);
});
