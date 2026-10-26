"use strict";

function toTrainingJsonl(examples) {
  if (!Array.isArray(examples)) throw new TypeError("Training examples must be an array.");
  return examples.map((example, index) => {
    if (!example || !Array.isArray(example.messages) ||
        !example.messages.some(message => message.role === "user") ||
        !example.messages.some(message => message.role === "assistant")) {
      throw new TypeError("Training example at index " + index + " has an invalid messages format.");
    }
    return JSON.stringify({ messages: example.messages });
  }).join("\n") + (examples.length ? "\n" : "");
}

module.exports = { toTrainingJsonl };
