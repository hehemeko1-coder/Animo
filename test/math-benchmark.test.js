"use strict";

// Deterministic math benchmark: these cases require no model API key and run in CI.
// Keep expected answers independently calculated and add a regression case for every
// solver failure discovered during real conversations.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  safeCalculate,
  solveLinearEquation,
  solveQuadraticEquation,
  solveLinearSystem,
  solveLinearInequality,
  solvePercentageProblem,
  solveFractionExpression,
  solveRatioProblem
} = require("../lib/agent-tools.js");

const benchmark = [
  { category: "arithmetic", name: "operator precedence", run: () => safeCalculate("18 * 7 + 30"), check: r => assert.equal(r.result, 156) },
  { category: "arithmetic", name: "nested parentheses", run: () => safeCalculate("(12 - 4) * (3 + 2)"), check: r => assert.equal(r.result, 40) },
  { category: "arithmetic", name: "negative exponent", run: () => safeCalculate("2^-3"), check: r => assert.equal(r.result, 0.125) },
  { category: "arithmetic", name: "square root", run: () => safeCalculate("sqrt(225)"), check: r => assert.equal(r.result, 15) },
  { category: "linear equations", name: "positive solution", run: () => solveLinearEquation("3x + 7 = 22"), check: r => assert.equal(r.result, 5) },
  { category: "linear equations", name: "negative solution", run: () => solveLinearEquation("2x + 4 = 0"), check: r => assert.equal(r.result, -2) },
  { category: "linear equations", name: "identity equation", run: () => solveLinearEquation("x + 2 = x + 2"), check: r => assert.equal(r.result, "all real numbers") },
  { category: "quadratics", name: "two distinct roots", run: () => solveQuadraticEquation("x^2 - 7x + 12 = 0"), check: r => assert.deepEqual(r.roots.slice().sort((a, b) => a - b), [3, 4]) },
  { category: "quadratics", name: "repeated root", run: () => solveQuadraticEquation("x^2 - 6x + 9 = 0"), check: r => assert.deepEqual(r.roots, [3]) },
  { category: "systems", name: "two variable system", run: () => solveLinearSystem("x + y = 9; x - y = 3"), check: r => assert.deepEqual(r.result, { x: 6, y: 3 }) },
  { category: "inequalities", name: "negative coefficient", run: () => solveLinearInequality("-3x + 6 > 0"), check: r => assert.equal(r.result, "x < 2") },
  { category: "percentages", name: "percentage of quantity", run: () => solvePercentageProblem("What is 12% of 250?"), check: r => assert.equal(r.result, 30) },
  { category: "percentages", name: "percentage increase", run: () => solvePercentageProblem("increase 120 by 25%"), check: r => assert.equal(r.result, 150) },
  { category: "percentages", name: "percentage decrease", run: () => solvePercentageProblem("decrease 80 by 30%"), check: r => assert.equal(r.result, 56) },
  { category: "fractions", name: "unlike denominators", run: () => solveFractionExpression("3/4 + 2/5"), check: r => assert.equal(r.result, "23/20") },
  { category: "fractions", name: "fraction division", run: () => solveFractionExpression("5/6 / 10/9"), check: r => assert.equal(r.result, "3/4") },
  { category: "fractions", name: "negative fraction", run: () => solveFractionExpression("1/3 - 2/3"), check: r => assert.equal(r.result, "-1/3") },
  { category: "ratios", name: "simplify ratio", run: () => solveRatioProblem("18:24"), check: r => assert.equal(r.result, "3:4") },
  { category: "ratios", name: "proportional cost", run: () => solveRatioProblem("If 4 cost 60 birr, how much would 10 cost?"), check: r => assert.equal(r.result, 150) }
];

for (const item of benchmark) {
  test("math benchmark / " + item.category + " / " + item.name, () => {
    const actual = item.run();
    assert.ok(actual && actual.error === undefined, actual && actual.error ? actual.error : "Solver returned no result");
    item.check(actual);
  });
}

test("math benchmark has coverage across all current deterministic solver categories", () => {
  const categories = new Set(benchmark.map(item => item.category));
  assert.deepEqual([...categories].sort(), [
    "arithmetic", "fractions", "inequalities", "linear equations",
    "percentages", "quadratics", "ratios", "systems"
  ]);
  assert.ok(benchmark.length >= 15, "Keep the benchmark broad enough to catch regressions");
});
