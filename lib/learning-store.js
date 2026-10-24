"use strict";

const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000
    })
  : null;

let initPromise;
async function init() {
  if (!pool) return false;
  if (!initPromise) initPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS seenai_learning_examples (
      id BIGSERIAL PRIMARY KEY,
      client_id VARCHAR(80) NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      rating SMALLINT,
      correction TEXT,
      consent BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      exported_at TIMESTAMPTZ,
      CHECK (rating IS NULL OR rating IN (-1, 1))
    );
    CREATE INDEX IF NOT EXISTS seenai_learning_examples_training_idx
      ON seenai_learning_examples (rating, consent, exported_at);
    CREATE TABLE IF NOT EXISTS seenai_learning_preferences (
      client_id VARCHAR(80) PRIMARY KEY,
      training_consent BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS seenai_memories (
      id BIGSERIAL PRIMARY KEY,
      client_id VARCHAR(80) NOT NULL,
      memory TEXT NOT NULL CHECK (char_length(memory) BETWEEN 1 AND 500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (client_id, memory)
    );
    CREATE INDEX IF NOT EXISTS seenai_memories_client_idx ON seenai_memories (client_id);
    CREATE TABLE IF NOT EXISTS seenai_training_jobs (
      id BIGSERIAL PRIMARY KEY,
      provider_job_id VARCHAR(120) NOT NULL UNIQUE,
      base_model VARCHAR(160) NOT NULL,
      status VARCHAR(40) NOT NULL,
      fine_tuned_model VARCHAR(200),
      example_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS seenai_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await initPromise;
  return true;
}
function validClientId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(value) ? value : null;
}
async function saveExample(clientId, prompt, response) {
  if (!pool) return null;
  await init();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // The chat request itself is only sent with learningOptIn=true. Create an initial
    // consent row if needed, then lock it so an opt-out cannot race this insert.
    await client.query(
      "INSERT INTO seenai_learning_preferences (client_id,training_consent) VALUES ($1,TRUE) ON CONFLICT (client_id) DO NOTHING",
      [clientId]
    );
    const preference = await client.query(
      "SELECT training_consent FROM seenai_learning_preferences WHERE client_id=$1 FOR SHARE",
      [clientId]
    );
    if (preference.rows[0]?.training_consent !== true) {
      await client.query("COMMIT");
      return null;
    }
    const result = await client.query(
      "INSERT INTO seenai_learning_examples (client_id,prompt,response,consent) VALUES ($1,$2,$3,TRUE) RETURNING id",
      [clientId, prompt.slice(0, 12000), response.slice(0, 12000)]
    );
    await client.query("COMMIT");
    return result.rows[0].id;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function setTrainingConsent(clientId, enabled) {
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  await init();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO seenai_learning_preferences (client_id,training_consent) VALUES ($1,$2) ON CONFLICT (client_id) DO UPDATE SET training_consent=EXCLUDED.training_consent,updated_at=NOW()",
      [clientId, enabled]
    );
    let revoked = 0;
    if (!enabled) {
      // Withdraw consent for saved examples so future fine-tuning queries exclude them.
      const result = await client.query(
        "UPDATE seenai_learning_examples SET consent=FALSE WHERE client_id=$1 AND consent=TRUE",
        [clientId]
      );
      revoked = result.rowCount;
    }
    await client.query("COMMIT");
    return { enabled, revoked };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function rateExample(clientId, id, rating, correction) {
  if (!pool) return false;
  await init();
  const result = await pool.query(
    "UPDATE seenai_learning_examples SET rating=$1, correction=$2 WHERE id=$3 AND client_id=$4",
    [rating, correction || null, id, clientId]
  );
  return result.rowCount > 0;
}
async function addMemory(clientId, memory) {
  if (!pool) return null;
  await init();
  const result = await pool.query(
    "INSERT INTO seenai_memories (client_id,memory) VALUES ($1,$2) ON CONFLICT (client_id,memory) DO UPDATE SET memory=EXCLUDED.memory RETURNING id,memory,created_at",
    [clientId, memory]
  );
  return result.rows[0];
}
async function listMemories(clientId) {
  if (!pool) return [];
  await init();
  const result = await pool.query("SELECT id,memory,created_at FROM seenai_memories WHERE client_id=$1 ORDER BY created_at DESC LIMIT 40", [clientId]);
  return result.rows;
}
async function deleteMemory(clientId, id) {
  if (!pool) return false;
  await init();
  const result = await pool.query("DELETE FROM seenai_memories WHERE client_id=$1 AND id=$2", [clientId, id]);
  return result.rowCount > 0;
}
async function clearMemories(clientId) {
  if (!pool) return 0;
  await init();
  const result = await pool.query("DELETE FROM seenai_memories WHERE client_id=$1", [clientId]);
  return result.rowCount;
}
async function trainingExamples(minimum = 10) {
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  await init();
  const result = await pool.query(
    "SELECT id,prompt,response,correction FROM seenai_learning_examples WHERE consent=TRUE AND (rating=1 OR correction IS NOT NULL) AND exported_at IS NULL ORDER BY id ASC LIMIT 5000"
  );
  return result.rows.map(row => ({
    id: row.id,
    messages: [
      { role: "system", content: "You are SeenAi, a helpful, accurate, safe AI assistant. Follow the user's request and explain uncertainty honestly." },
      { role: "user", content: row.prompt },
      { role: "assistant", content: row.correction || row.response }
    ]
  })).filter(row => row.messages[1].content.trim() && row.messages[2].content.trim()).slice(0, 5000).filter(row => row.messages.length === 3 && row.messages[2].content.length > 0);
}
async function markExported(ids) {
  if (!pool || !ids.length) return;
  await init();
  await pool.query("UPDATE seenai_learning_examples SET exported_at=NOW() WHERE id = ANY($1::bigint[])", [ids]);
}
async function saveTrainingJob(providerJobId, baseModel, status, exampleCount) {
  if (!pool) return null;
  await init();
  const result = await pool.query(
    "INSERT INTO seenai_training_jobs (provider_job_id,base_model,status,example_count) VALUES ($1,$2,$3,$4) ON CONFLICT (provider_job_id) DO UPDATE SET status=EXCLUDED.status,updated_at=NOW() RETURNING *",
    [providerJobId, baseModel, status, exampleCount]
  );
  return result.rows[0];
}
async function getTrainingJob(providerJobId) {
  if (!pool) return null;
  await init();
  const result = await pool.query("SELECT * FROM seenai_training_jobs WHERE provider_job_id=$1", [providerJobId]);
  return result.rows[0] || null;
}
async function updateTrainingJob(providerJobId, status, fineTunedModel) {
  if (!pool) return null;
  await init();
  const result = await pool.query(
    "UPDATE seenai_training_jobs SET status=$2,fine_tuned_model=COALESCE($3,fine_tuned_model),updated_at=NOW() WHERE provider_job_id=$1 RETURNING *",
    [providerJobId, status, fineTunedModel || null]
  );
  return result.rows[0] || null;
}
async function setActiveModel(model) {
  if (!pool || typeof model !== "string" || !model.startsWith("ft:")) return false;
  await init();
  await pool.query("INSERT INTO seenai_settings (key,value) VALUES ('openai_active_model',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", [model]);
  return true;
}
async function getActiveModel() {
  if (!pool) return null;
  await init();
  const result = await pool.query("SELECT value FROM seenai_settings WHERE key='openai_active_model'");
  return result.rows[0]?.value || null;
}
async function close() { if (pool) await pool.end(); }

module.exports = { enabled: Boolean(pool), init, validClientId, saveExample, setTrainingConsent, rateExample, addMemory, listMemories, deleteMemory, clearMemories, trainingExamples, markExported, saveTrainingJob, getTrainingJob, updateTrainingJob, setActiveModel, getActiveModel, close };
