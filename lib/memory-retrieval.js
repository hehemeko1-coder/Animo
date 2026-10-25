"use strict";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can",
  "do", "does", "for", "from", "had", "has", "have", "how", "i", "if",
  "in", "is", "it", "me", "my", "of", "on", "or", "our", "please", "so",
  "that", "the", "this", "to", "was", "we", "what", "when", "where",
  "which", "who", "why", "with", "you", "your"
]);

function tokens(value) {
  return new Set(
    String(value || "").toLowerCase().match(/[a-z0-9]{2,}/g)?.filter(token => !STOP_WORDS.has(token)) || []
  );
}

function rankMemories(memories, query, limit = 12) {
  if (!Array.isArray(memories) || limit <= 0) return [];
  const queryTokens = tokens(query);
  const indexed = memories.map((memory, index) => {
    const memoryTokens = tokens(memory?.memory);
    let overlap = 0;
    for (const token of queryTokens) if (memoryTokens.has(token)) overlap++;
    // Relevance dominates; original ordering (normally newest first) breaks ties.
    return { memory, index, score: overlap * 100 - index * 0.001 };
  });
  if (queryTokens.size) {
    indexed.sort((a, b) => b.score - a.score);
  }
  return indexed.slice(0, Math.floor(limit)).map(item => item.memory);
}

module.exports = { rankMemories };
