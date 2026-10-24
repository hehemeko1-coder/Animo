"use strict";

function resolveEvalConfig(env = process.env) {
  const PROVIDER = String(env.EVAL_PROVIDER || env.AI_PROVIDER || "groq").toLowerCase();
  const providerModel = PROVIDER === "anthropic"
    ? env.ANTHROPIC_MODEL
    : PROVIDER === "openai"
      ? env.OPENAI_MODEL
      : env.GROQ_MODEL;
  const defaultModel = PROVIDER === "anthropic"
    ? "claude-opus-5-5"
    : PROVIDER === "openai"
      ? "gpt-4o-mini"
      : "openai/gpt-oss-120b";
  const MODEL = env.EVAL_MODEL || providerModel || defaultModel;
  const API_KEY = env.EVAL_API_KEY || (PROVIDER === "anthropic"
    ? env.ANTHROPIC_API_KEY
    : PROVIDER === "openai"
      ? env.OPENAI_API_KEY
      : env.GROQ_API_KEY);
  const defaultBaseUrl = PROVIDER === "openai"
    ? "https://api.openai.com/v1"
    : "https://api.groq.com/openai/v1";
  const BASE_URL = String(env.EVAL_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
  return { PROVIDER, MODEL, API_KEY, BASE_URL };
}

module.exports = { resolveEvalConfig };
