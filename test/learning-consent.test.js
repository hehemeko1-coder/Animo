"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// Stub pg so the consent lifecycle can be tested deterministically without a real database.
const pgPath = require.resolve("pg");
const previousPgModule = require.cache[pgPath];
const originalDatabaseUrl = process.env.DATABASE_URL;

class FakeClient {
  constructor(pool) { this.pool = pool; }
  async query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) return { rows: [], rowCount: 0 };

    if (sql.includes("INSERT INTO seenai_learning_preferences") && sql.includes("DO NOTHING")) {
      const [clientId] = params;
      if (!this.pool.preferences.has(clientId)) this.pool.preferences.set(clientId, true);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO seenai_learning_preferences") && sql.includes("DO UPDATE")) {
      const [clientId, enabled] = params;
      this.pool.preferences.set(clientId, enabled);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SELECT training_consent FROM seenai_learning_preferences")) {
      const [clientId] = params;
      return { rows: this.pool.preferences.has(clientId) ? [{ training_consent: this.pool.preferences.get(clientId) }] : [], rowCount: 1 };
    }
    if (sql.includes("UPDATE seenai_learning_examples SET consent=FALSE")) {
      const [clientId] = params;
      let rowCount = 0;
      for (const row of this.pool.examples) {
        if (row.client_id === clientId && row.consent === true) { row.consent = false; rowCount++; }
      }
      return { rows: [], rowCount };
    }
    if (sql.includes("INSERT INTO seenai_learning_examples")) {
      const [client_id, prompt, response] = params;
      const row = { id: this.pool.nextId++, client_id, prompt, response, consent: true, rating: null, correction: null, exported_at: null };
      this.pool.examples.push(row);
      return { rows: [{ id: row.id }], rowCount: 1 };
    }
    throw new Error("Unexpected fake client query: " + sql);
  }
  release() {}
}

class FakePool {
  static instances = [];
  constructor() {
    this.preferences = new Map();
    this.examples = [];
    this.nextId = 1;
    FakePool.instances.push(this);
  }
  async query(sql, params = []) {
    if (/CREATE TABLE|CREATE INDEX/i.test(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes("UPDATE seenai_learning_examples SET rating=")) {
      const [rating, correction, id, clientId] = params;
      const row = this.examples.find(item => item.id === Number(id) && item.client_id === clientId);
      if (row) { row.rating = rating; row.correction = correction; }
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes("SELECT id,prompt,response,correction FROM seenai_learning_examples")) {
      const rows = this.examples
        .filter(row => row.consent === true && (row.rating === 1 || row.correction !== null) && row.exported_at === null)
        .sort((a, b) => a.id - b.id)
        .slice(0, 5000)
        .map(({ id, prompt, response, correction }) => ({ id, prompt, response, correction }));
      return { rows, rowCount: rows.length };
    }
    throw new Error("Unexpected fake pool query: " + sql);
  }
  async connect() { return new FakeClient(this); }
  async end() {}
}

require.cache[pgPath] = {
  id: pgPath, filename: pgPath, loaded: true, exports: { Pool: FakePool }, children: [], paths: []
};
process.env.DATABASE_URL = "postgres://test.invalid/seenai";
const storePath = require.resolve("../lib/learning-store");
delete require.cache[storePath];
const store = require("../lib/learning-store");
const fakePool = () => FakePool.instances[0];

test("opting out revokes saved examples and blocks new examples until opted in again", async () => {
  const clientId = "sai_testclient_1234567890";

  await store.setTrainingConsent(clientId, true);
  const firstId = await store.saveExample(clientId, "prompt one", "response one");
  assert.equal(firstId, 1);
  await store.rateExample(clientId, firstId, 1, "");

  assert.equal((await store.trainingExamples()).length, 1);

  const optOut = await store.setTrainingConsent(clientId, false);
  assert.equal(optOut.enabled, false);
  assert.equal(optOut.revoked, 1);
  assert.equal(fakePool().examples[0].consent, false);
  assert.equal((await store.trainingExamples()).length, 0);
  assert.equal(await store.saveExample(clientId, "prompt while opted out", "response"), null);

  await store.setTrainingConsent(clientId, true);
  const secondId = await store.saveExample(clientId, "prompt two", "response two");
  assert.equal(secondId, 2);
  await store.rateExample(clientId, secondId, 1, "");

  const trainable = await store.trainingExamples();
  assert.deepEqual(trainable.map(row => row.id), [2]);
  assert.equal(fakePool().examples[0].consent, false);
});

test.after(async () => {
  await store.close();
  delete require.cache[storePath];
  if (previousPgModule) require.cache[pgPath] = previousPgModule;
  else delete require.cache[pgPath];
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});
