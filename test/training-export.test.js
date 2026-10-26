"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { toTrainingJsonl } = require("../lib/training-export");

test("formats eligible examples as one valid JSONL record each", () => {
  const examples = [
    { messages: [{ role: "user", content: "Explain arrays." }, { role: "assistant", content: "Arrays hold ordered values." }] },
    { messages: [{ role: "user", content: "What is 2+2?" }, { role: "assistant", content: "4" }] }
  ];
  const lines = toTrainingJsonl(examples).trimEnd().split("\n").map(JSON.parse);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].messages[0].content, "Explain arrays.");
});

test("rejects malformed examples rather than exporting them", () => {
  assert.throws(() => toTrainingJsonl([{ messages: [] }]), /invalid messages format/);
  assert.throws(() => toTrainingJsonl(null), /must be an array/);
});

test("returns an empty string for an empty dataset", () => {
  assert.equal(toTrainingJsonl([]), "");
});
