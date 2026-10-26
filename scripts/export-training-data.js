"use strict";

// Exports only consented, positively rated or corrected, safety-screened examples
// from the configured PostgreSQL database. This script never uploads data.
const fs = require("node:fs/promises");
const path = require("node:path");
const learningStore = require("../lib/learning-store");
const { toTrainingJsonl } = require("../lib/training-export");

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("No data exported. Re-run with --confirm after reviewing consent and privacy requirements.");
    process.exitCode = 2;
    return;
  }
  if (!learningStore.enabled) {
    console.error("DATABASE_URL is required to export approved examples.");
    process.exitCode = 2;
    return;
  }
  try {
    const examples = await learningStore.trainingExamples();
    if (examples.length < 10) {
      console.error("At least 10 eligible examples are required. Currently available: " + examples.length + ".");
      process.exitCode = 2;
      return;
    }
    const jsonl = toTrainingJsonl(examples);
    const outputDir = path.resolve(process.cwd(), "training-data");
    await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
    const filename = "animo-training-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jsonl";
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, jsonl, { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log("Exported " + examples.length + " screened, consented examples to " + outputPath);
    console.log("This file remains local; inspect it before using it for any training run.");
  } finally {
    await learningStore.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("Training export failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
