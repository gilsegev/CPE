#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { generateManifest } = require("./core");
const { applyContentMigration } = require("./content");
const { createDirectusClient, readInventory } = require("./directus");
const { buildRolloutReport } = require("./rollout");
const {
  applyDatabaseConstraints,
  applyDirectusSchema,
  collectionDefinitions,
  existingFields,
  verifyFeedbackPermissions,
  verifyDatabaseConstraints,
} = require("./schema");

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, execute: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--execute") options.execute = true;
    else if (argument === "--output") options.output = rest[++index];
    else if (argument === "--manifest") options.manifest = rest[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function usage() {
  console.log(`Module-based course migration

Commands:
  schema [--execute]                  Add the Directus schema and PostgreSQL constraints.
  manifest --output <file>            Generate a read-only production inventory and approval manifest.
  apply --manifest <file> [--execute] Validate, then apply only explicitly approved course entries.
  verify                              Verify the installed schema and summarize migration state.
  cleanup-check                       Fail closed until legacy runtime behavior can be retired safely.

The schema and apply commands are dry-run unless --execute is supplied.`);
}

async function buildVerificationSummary(client) {
  const collections = await client.request("/collections?limit=-1");
  const collectionNames = new Set(collections.map((row) => row.collection));
  const missing = [];
  for (const [collection, definition] of Object.entries(collectionDefinitions)) {
    if (!collectionNames.has(collection)) {
      missing.push(`collection ${collection}`);
      continue;
    }
    const fields = new Set((await client.request(`/fields/${collection}`)).map((row) => row.field));
    for (const field of definition.fields) if (!fields.has(field.field)) missing.push(`field ${collection}.${field.field}`);
  }
  for (const [collection, definitions] of Object.entries(existingFields)) {
    const fields = new Set((await client.request(`/fields/${collection}`)).map((row) => row.field));
    for (const field of definitions) if (!fields.has(field.field)) missing.push(`field ${collection}.${field.field}`);
  }
  missing.push(...await verifyFeedbackPermissions(client));
  const inventory = await readInventory(client);
  const states = inventory.courses.reduce((counts, course) => {
    const state = course.structure_version || "missing";
    counts[state] = (counts[state] || 0) + 1;
    return counts;
  }, {});
  const database = await verifyDatabaseConstraints();
  const rollout = buildRolloutReport(inventory);
  if (!database.checked) rollout.cleanupReadiness.blockers.push("database constraints were not checked");
  if (database.missing.length > 0) rollout.cleanupReadiness.blockers.push("database constraints are incomplete");
  if (missing.length > 0) rollout.cleanupReadiness.blockers.push("Directus schema or permissions are incomplete");
  rollout.cleanupReadiness.blockers = [...new Set(rollout.cleanupReadiness.blockers)];
  rollout.cleanupReadiness.ready = rollout.cleanupReadiness.blockers.length === 0;
  return {
    schema: missing.length > 0 || database.missing.length > 0
      ? "incomplete"
      : database.checked ? "complete" : "database_unchecked",
    missing,
    databaseConstraints: database,
    courseStructureVersions: states,
    records: {
      quizAttempts: (await client.listAll("QuizAttempts", "id")).length,
      courseCompletions: (await client.listAll("CourseCompletions", "id")).length,
      feedbackResponses: (await client.listAll("FeedbackResponses", "id")).length,
      linkedCertificates: inventory.certificates.filter((row) => row.completion_id).length,
      legacyCertificates: inventory.certificates.filter((row) => !row.completion_id).length,
    },
    rollout,
  };
}

async function verify(client, requireCleanupReady = false) {
  const summary = await buildVerificationSummary(client);
  console.log(JSON.stringify(summary, null, 2));
  if (
    summary.missing.length > 0
    || summary.databaseConstraints.missing.length > 0
    || (requireCleanupReady && !summary.rollout.cleanupReadiness.ready)
  ) process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.command || options.command === "help" || options.command === "--help") {
    usage();
    return;
  }
  const client = createDirectusClient();

  if (options.command === "schema") {
    if (!options.execute) {
      console.log("Dry run: schema would add the v2 collections, fields, relations, permission restrictions, indexes, and constraints.");
      return;
    }
    await applyDirectusSchema(client);
    await applyDatabaseConstraints();
    console.log("Module-course schema migration completed.");
    return;
  }

  if (options.command === "manifest") {
    if (!options.output) throw new Error("manifest requires --output <file>");
    const manifest = generateManifest(await readInventory(client));
    const outputPath = path.resolve(options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "w" });
    console.log(JSON.stringify({ output: outputPath, summary: manifest.summary }, null, 2));
    return;
  }

  if (options.command === "apply") {
    if (!options.manifest) throw new Error("apply requires --manifest <file>");
    const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8"));
    if (!options.execute) {
      const { validateManifest } = require("./core");
      const errors = validateManifest(manifest, await readInventory(client));
      console.log(JSON.stringify({ executable: errors.length === 0, errors }, null, 2));
      if (errors.length > 0) process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(await applyContentMigration(client, manifest), null, 2));
    return;
  }

  if (options.command === "verify") {
    await verify(client);
    return;
  }

  if (options.command === "cleanup-check") {
    await verify(client, true);
    return;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
