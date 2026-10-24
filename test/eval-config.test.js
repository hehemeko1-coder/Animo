"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveEvalConfig } = require("../lib/eval-config");

test("evaluation config defaults to Groq without reading unrelated provider settings", () => {
  assert.deepEqual(resolveEvalConfig({
    GROQ_MODEL: "groq-custom",
    OPENAI_MODEL: "openai-custom",
    ANTHROPIC_MODEL: "claude-custom",
    GROQ_API_KEY: "groq-key",
    OPENAI_API_KEY: "openai-key"
  }), {
    PROVIDER: "groq",
    MODEL: "groq-custom",
    API_KEY: "groq-key",
    BASE_URL: "https://api.groq.com/openai/v1"
  });
});

test("explicit provider selects its own model, key, and endpoint", () => {
  const openai = resolveEvalConfig({
    EVAL_PROVIDER: "openai",
    GROQ_MODEL: "wrong-groq-model",
    OPENAI_MODEL: "right-openai-model",
    GROQ_API_KEY: "wrong-groq-key",
    OPENAI_API_KEY: "right-openai-key"
  });
  assert.equal(openai.MODEL, "right-openai-model");
  assert.equal(openai.API_KEY, "right-openai-key");
  assert.equal(openai.BASE_URL, "https://api.openai.com/v1");

  const anthropic = resolveEvalConfig({
    EVAL_PROVIDER: "anthropic",
    GROQ_MODEL: "wrong-groq-model",
    ANTHROPIC_MODEL: "right-claude-model",
    GROQ_API_KEY: "wrong-groq-key",
    ANTHROPIC_API_KEY: "right-claude-key"
  });
  assert.equal(anthropic.MODEL, "right-claude-model");
  assert.equal(anthropic.API_KEY, "right-claude-key");
});

test("explicit evaluation overrides take precedence and normalize endpoint slashes", () => {
  const config = resolveEvalConfig({
    EVAL_PROVIDER: "openai",
    EVAL_MODEL: "eval-model",
    EVAL_API_KEY: "eval-key",
    EVAL_BASE_URL: "https://gateway.example/v1///",
    OPENAI_MODEL: "provider-model",
    OPENAI_API_KEY: "provider-key"
  });
  assert.equal(config.MODEL, "eval-model");
  assert.equal(config.API_KEY, "eval-key");
  assert.equal(config.BASE_URL, "https://gateway.example/v1");
});

test("provider defaults remain predictable when provider-specific values are absent", () => {
  assert.equal(resolveEvalConfig({ EVAL_PROVIDER: "anthropic" }).MODEL, "claude-opus-5-5");
  assert.equal(resolveEvalConfig({ EVAL_PROVIDER: "openai" }).MODEL, "gpt-4o-mini");
  assert.equal(resolveEvalConfig({ EVAL_PROVIDER: "groq" }).MODEL, "openai/gpt-oss-120b");
});
