"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { safeCalculate, shouldForceCalculator, normalizeFirecrawlResults } = require("../lib/agent-tools");

test("calculator respects arithmetic precedence and parentheses", () => {
  assert.deepEqual(safeCalculate("2 + 3 * 4"), { result: 14 });
  assert.deepEqual(safeCalculate("(2 + 3) * 4"), { result: 20 });
  assert.deepEqual(safeCalculate("-5 + 2.5"), { result: -2.5 });
  assert.deepEqual(safeCalculate("17 % 5"), { result: 2 });
});

test("calculator rejects malformed, unsafe, and non-finite expressions", () => {
  assert.ok(safeCalculate("1 / 0").error);
  assert.ok(safeCalculate("2 + (3").error);
  assert.ok(safeCalculate("process.exit()").error);
  assert.ok(safeCalculate("2 ** 3").error);
  assert.ok(safeCalculate("1".repeat(121)).error);
});

test("Firecrawl normalizer handles flat results and ignores unsafe URLs", () => {
  const result = normalizeFirecrawlResults({ data: [
    { title: "Docs", url: "https://example.com/docs", description: "Official docs" },
    { title: "Unsafe", url: "javascript:alert(1)", description: "ignore" },
    { metadata: { title: "Second", sourceURL: "https://example.org", description: "Snippet" } }
  ] });
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Docs");
  assert.equal(result[0].snippet, "Official docs");
  assert.equal(result[1].title, "Second");
  assert.equal(result[1].url, "https://example.org");
});

test("Firecrawl normalizer handles grouped web/news results and enforces bounds", () => {
  const data = { data: {
    web: Array.from({ length: 4 }, (_, i) => ({ title: "W" + i, url: "https://web.example/" + i, markdown: "x".repeat(1600) })),
    news: Array.from({ length: 4 }, (_, i) => ({ title: "N" + i, url: "https://news.example/" + i, content: "story" }))
  } };
  const result = normalizeFirecrawlResults(data);
  assert.equal(result.length, 5);
  assert.ok(result.every(item => item.title.length <= 200 && item.snippet.length <= 1400));
});

test("Firecrawl normalizer returns an empty list for missing data", () => {
  assert.deepEqual(normalizeFirecrawlResults({}), []);
});

test("calculator is forced for bare arithmetic and short math questions", () => {
  assert.equal(shouldForceCalculator("2 + 2"), true);
  assert.equal(shouldForceCalculator("what is (8 + 4) / 3?"), true);
  assert.equal(shouldForceCalculator("18 * 7 + 30"), true);
  assert.equal(shouldForceCalculator("Calculate 15 percent of 80"), true);
});

test("calculator detection avoids ordinary prose and ISO-style dates", () => {
  assert.equal(shouldForceCalculator("I have 2 apples and got 3 more"), false);
  assert.equal(shouldForceCalculator("What happened on 2026-10-22?"), false);
  assert.equal(shouldForceCalculator("Explain why multiplication works"), false);
});
