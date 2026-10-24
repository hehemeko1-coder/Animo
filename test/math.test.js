"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { safeCalculate, solveLinearEquation, solveQuadraticEquation, solveLinearSystem, shouldForceCalculator } = require("../lib/agent-tools.js");

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

test("unary signs, decimals, and alternate operator symbols", () => {
  result("-(3 + 2) * 4", -20);
  result("--5", 5);
  result(".5 + 1.25", 1.75);
  result("2 × 3 + 8 ÷ 4", 8);
  result("2^(-2)", 0.25);
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
  assert.ok(safeCalculate("2^1001").error);
  assert.ok(safeCalculate("0^-1").error);
  assert.ok(safeCalculate("sqrt()").error);
  assert.ok(safeCalculate("1..2 + 3").error);
});

test("solves and verifies linear equations", () => {
  const solved = solveLinearEquation("2x + 5 = 15");
  assert.equal(solved.error, undefined, solved.error);
  assert.equal(solved.result, 5);
  assert.match(solved.steps[3], /left and .* on the right/);

  assert.equal(solveLinearEquation("3*x - 2 = 10").result, 4);
  assert.equal(solveLinearEquation("x + 2 = x + 2").result, "all real numbers");
  assert.ok(solveLinearEquation("x + 2 = x + 3").error);
  assert.ok(solveLinearEquation("x^2 = 9").error);
  assert.ok(solveLinearEquation("x = 2 = 3").error);
});


test("solves quadratic equations and verifies real roots", () => {
  const solved = solveQuadraticEquation("x^2 - 5x + 6 = 0");
  assert.equal(solved.error, undefined, solved.error);
  assert.deepEqual(solved.roots.slice().sort((a, b) => a - b), [2, 3]);
  assert.equal(solveQuadraticEquation("x^2 - 4x + 4 = 0").roots.length, 1);
  assert.deepEqual(solveQuadraticEquation("x^2 = 9").roots.slice().sort((a, b) => a - b), [-3, 3]);
  assert.deepEqual(solveQuadraticEquation("x^2 + 2x + 1 = 0").roots, [-1]);
  assert.deepEqual(solveQuadraticEquation("0.5x^2 - 2 = 0").roots.slice().sort((a, b) => a - b), [-2, 2]);
  assert.deepEqual(solveQuadraticEquation("2x^2 - 8 = 0").roots.slice().sort((a, b) => a - b), [-2, 2]);
  assert.ok(solveQuadraticEquation("x^2 + 1 = 0").error);
  assert.ok(solveQuadraticEquation("x^3 = 8").error);
});


test("solves and verifies two-variable linear systems", () => {
  const solved = solveLinearSystem("x + y = 10; x - y = 2");
  assert.equal(solved.error, undefined, solved.error);
  assert.equal(solved.result.x, 6);
  assert.equal(solved.result.y, 4);
  const simple = solveLinearSystem(["x = 3", "y = 7"]);
  assert.equal(simple.error, undefined, simple.error);
  assert.deepEqual(simple.result, { x: 3, y: 7 });
  assert.ok(solveLinearSystem("x + y = 2; 2x + 2y = 4").error);
  assert.ok(solveLinearSystem("x + y = 2; x + y = 5").error);
  assert.ok(solveLinearSystem("x^2 + y = 2; x - y = 0").error);
});

test("calculator intent detection", () => {
  assert.equal(shouldForceCalculator("Calculate sqrt(144)"), true);
  assert.equal(shouldForceCalculator("2 + 2"), true);
  assert.equal(shouldForceCalculator("Tell me a story about 2 dragons"), false);
});
