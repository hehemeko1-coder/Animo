"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { rankMemories } = require("../lib/memory-retrieval");

test("ranks memories matching the current question above unrelated recent memories", () => {
  const memories = [
    { id: 4, memory: "User is building a website with Express and Neon." },
    { id: 3, memory: "User prefers concise technical explanations." },
    { id: 2, memory: "My favorite color is blue." },
    { id: 1, memory: "User uses GitHub for project hosting." }
  ];
  assert.equal(rankMemories(memories, "What is my favorite color?")[0].id, 2);
});

test("keeps newest-first ordering when there is no useful token overlap", () => {
  const memories = [{ id: 2, memory: "I use GitHub." }, { id: 1, memory: "I prefer blue." }];
  assert.deepEqual(rankMemories(memories, "volcanoes on Mars").map(item => item.id), [2, 1]);
});

test("supports limits and empty inputs", () => {
  assert.deepEqual(rankMemories([], "color"), []);
  assert.equal(rankMemories([{ memory: "one" }, { memory: "two" }], "", 1).length, 1);
});
