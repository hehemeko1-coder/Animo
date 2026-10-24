"use strict";

// Conservative, deterministic memory extraction. Only explicit, durable preferences
// and project facts are saved; sensitive categories and transient requests are skipped.
const SENSITIVE = /\b(password|passcode|secret|api[_ -]?key|token|credit card|bank account|medical|diagnos(?:is|ed)|medication|religion|political party|sexual orientation|social security|passport number)\b/i;
const PATTERNS = [
  /\b(?:please )?(?:remember|keep in mind) that\s+(.{8,300})$/i,
  /\b(?:i prefer|i like|i usually prefer|my preferred)\s+(.{8,250})$/i,
  /\b(?:i am working on|i'm working on|my project is|i am building|i'm building)\s+(.{8,250})$/i,
  /\b(?:i use|my setup uses|my stack is)\s+(.{8,200})$/i,
  /\b(?:in future|from now on|going forward),?\s+(?:please )?(.{8,250})$/i
];

function extractMemoryCandidate(input) {
  if (typeof input !== "string") return null;
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length < 12 || text.length > 12000 || SENSITIVE.test(text)) return null;
  for (const pattern of PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    let candidate = match[1].trim().replace(/[.!?]+$/, "");
    if (candidate.length < 8 || SENSITIVE.test(candidate)) return null;
    if (/^(?:the answer is|solve this|what is|how do i|can you|please solve)\b/i.test(candidate)) return null;
    candidate = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    return candidate.slice(0, 500);
  }
  return null;
}

module.exports = { extractMemoryCandidate };
