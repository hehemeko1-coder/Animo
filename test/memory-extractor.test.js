"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractMemoryCandidate } = require("../lib/memory-extractor");

test("extracts explicit durable preferences and project facts", () => {
  assert.equal(extractMemoryCandidate("I prefer step-by-step explanations in future chats."), "Step-by-step explanations in future chats");
  assert.equal(extractMemoryCandidate("I'm working on SeenAi, an AI assistant project."), "SeenAi, an AI assistant project");
  assert.equal(extractMemoryCandidate("Remember that I use Node.js and PostgreSQL for my app."), "I use Node.js and PostgreSQL for my app");
});

test("ignores ordinary requests, short text, and sensitive information", () => {
  assert.equal(extractMemoryCandidate("What is 2 + 2?"), null);
  assert.equal(extractMemoryCandidate("hello"), null);
  assert.equal(extractMemoryCandidate("I prefer sharing my password with nobody."), null);
  assert.equal(extractMemoryCandidate(null), null);
});

test("does not save unrecognized statements", () => {
  assert.equal(extractMemoryCandidate("Write a poem about rain and summer."), null);
});
