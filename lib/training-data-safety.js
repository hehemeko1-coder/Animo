"use strict";

// Conservative screening for fine-tuning examples. This is a risk-reduction
// layer, not a guarantee that all personal or sensitive data can be detected.
const SENSITIVE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:password|passwd|pwd|secret|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/i,
  /\b(?:\d[ -]*?){13,19}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[ .()-]*){9,}\b/
];

function containsSensitiveData(value) {
  if (typeof value !== "string") return true;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
}

function isSafeTrainingExample(prompt, response) {
  if (typeof prompt !== "string" || typeof response !== "string") return false;
  const user = prompt.trim();
  const assistant = response.trim();
  if (!user || !assistant || user.length > 12000 || assistant.length > 12000) return false;
  return !containsSensitiveData(user) && !containsSensitiveData(assistant);
}

module.exports = { containsSensitiveData, isSafeTrainingExample };
