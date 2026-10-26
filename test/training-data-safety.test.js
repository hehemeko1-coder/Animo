"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { containsSensitiveData, isSafeTrainingExample } = require("../lib/training-data-safety");

test("flags common API keys and credentials", () => {
  assert.equal(containsSensitiveData("api_key=sk-abcdefghijklmnopqrstuvwxyz123456"), true);
  assert.equal(containsSensitiveData("ghp_abcdefghijklmnopqrstuvwxyz1234567890"), true);
  assert.equal(containsSensitiveData("password: mySecret123"), true);
});

test("flags private contact and payment-like data", () => {
  assert.equal(containsSensitiveData("email me at person@example.com"), true);
  assert.equal(containsSensitiveData("card 4111 1111 1111 1111"), true);
});

test("allows ordinary non-sensitive training examples", () => {
  assert.equal(isSafeTrainingExample("Explain a JavaScript promise.", "A promise represents a future result."), true);
});

test("rejects examples containing sensitive patterns or empty text", () => {
  assert.equal(isSafeTrainingExample("My password=hunter2", "Okay"), false);
  assert.equal(isSafeTrainingExample(" ", "A response"), false);
  assert.equal(isSafeTrainingExample("A question", ""), false);
});
