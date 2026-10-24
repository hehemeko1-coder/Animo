"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { safeCalculate, solveLinearEquation, solveQuadraticEquation, solveLinearSystem, solveLinearInequality, solvePercentageProblem, solveFractionExpression, solveRatioProblem, shouldForceCalculator } = require("../lib/agent-tools.js");

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


test("solves linear inequalities and reports interval notation", () => {
  const less = solveLinearInequality("2x + 3 < 11");
  assert.equal(less.error, undefined, less.error);
  assert.equal(less.result, "x < 4");
  assert.equal(less.interval, "(-∞, 4)");
  assert.equal(solveLinearInequality("-2x + 4 >= 0").result, "x ≤ 2");
  assert.equal(solveLinearInequality("x + 1 <= x + 3").interval, "(-∞, ∞)");
  assert.equal(solveLinearInequality("x + 3 < x + 1").interval, "∅");
  assert.ok(solveLinearInequality("x^2 < 9").error);
});

test("calculator intent detection", () => {
  assert.equal(shouldForceCalculator("Calculate sqrt(144)"), true);
  assert.equal(shouldForceCalculator("2 + 2"), true);
  assert.equal(shouldForceCalculator("Tell me a story about 2 dragons"), false);
});


test("solves percentage calculations with clear working", () => {
  const of = solvePercentageProblem("What is 20% of 150?");
  assert.equal(of.result, 30);
  assert.equal(of.error, undefined);
  assert.equal(of.steps.length, 2);
  assert.equal(solvePercentageProblem("increase 80 by 15%").result, 92);
  assert.equal(solvePercentageProblem("decrease 80 by 15%").result, 68);
  assert.equal(solvePercentageProblem("discount 25% from 400").result, 300);
  assert.equal(solvePercentageProblem("15 out of 60").result, 25);
  assert.equal(solvePercentageProblem("15 out of 0").error, "Cannot calculate a percentage of a zero total.");
  assert.equal(solvePercentageProblem("Tell me a story about 20% of a dragon"), null);
});


test("fraction expressions simplify and calculate exactly", () => {
  assert.equal(solveFractionExpression("1/2 + 1/3").result, "5/6");
  const unlikeDenominators = solveFractionExpression("3/4 + 2/5");
  assert.equal(unlikeDenominators.result, "23/20");
  assert.match(unlikeDenominators.steps[1], /already in simplest form/);
  assert.doesNotMatch(unlikeDenominators.steps[1], /dividing.*by 1/);
  assert.equal(solveFractionExpression("2/4").result, "1/2");
  assert.equal(solveFractionExpression("3/4 - 1/4").result, "1/2");
  assert.equal(solveFractionExpression("2/3 * 3/4").result, "1/2");
  assert.equal(solveFractionExpression("1/0").error, "A fraction denominator cannot be zero.");
  assert.equal(solveFractionExpression("Tell me a story"), null);
});

test("ratios simplify and unit-price questions scale correctly", () => {
  assert.equal(solveRatioProblem("12:8").result, "3:2");
  assert.equal(solveRatioProblem("If 2 cost 50 birr, how much would 6 cost?").result, 150);
  assert.ok(solveRatioProblem("0:0").error);
});

test("fraction division, signed fractions, and zero-divisor validation", () => {
  assert.equal(solveFractionExpression("1/2 / 3/4").result, "2/3");
  assert.equal(solveFractionExpression("-2/4").result, "-1/2");
  assert.equal(solveFractionExpression("1/-2").result, "-1/2");
  assert.equal(solveFractionExpression("-1/-2").result, "1/2");
  assert.equal(solveFractionExpression("1/2 / 0/5").error, "Cannot divide by a zero fraction.");
});

test("fraction arithmetic handles negative results and reduction to zero", () => {
  assert.equal(solveFractionExpression("1/3 - 2/3").result, "-1/3");
  assert.equal(solveFractionExpression("2/3 - 2/3").result, "0");
  assert.equal(solveFractionExpression("1/2 + 1/-2").result, "0");
});

test("percentage parser normalizes repeated whitespace", () => {
  assert.equal(solvePercentageProblem("What is  20%   of   150?").result, 30);
  assert.equal(solvePercentageProblem("increase   80 by  15%").result, 92);
});

test("ratio simplification normalizes negative signs", () => {
  assert.equal(solveRatioProblem("-12:8").result, "-3:2");
  assert.equal(solveRatioProblem("12:-8").result, "-3:2");
  assert.equal(solveRatioProblem("-12:-8").result, "3:2");
});

test("fraction and ratio solvers safely reject oversized values", () => {
  assert.ok(solveFractionExpression("999999999/2 * 999999999/2").error);
  assert.equal(solveRatioProblem("0:8").result, "0:1");
});
