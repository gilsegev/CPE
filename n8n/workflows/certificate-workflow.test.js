const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflowPath = path.join(__dirname, "certificate_generation_pipeline_APzyGskMoXRCHBtH.json");
const reconciliationPath = path.join(__dirname, "certificate_reconciliation_pending.json");
const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
const reconciliation = JSON.parse(fs.readFileSync(reconciliationPath, "utf8"));

const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]));

test("certificate worker consumes a certificate ID and never reads an essay submission", () => {
  const serialized = JSON.stringify(workflow);
  assert.match(nodeByName.get("Normalize Work Key").parameters.jsCode, /certificateId/);
  assert.doesNotMatch(serialized, /Submissions|Approved/);
});

test("worker atomically claims one pending record and updates the same certificate", () => {
  const claim = nodeByName.get("Claim Certificate");
  assert.match(claim.parameters.url, /items\/Certificates$/);
  assert.equal(claim.parameters.method, "PATCH");
  assert.match(claim.parameters.jsonBody, /query: \{ filter:/);
  assert.match(claim.parameters.jsonBody, /status: \{ _eq: 'pending' \}/);
  assert.match(claim.parameters.jsonBody, /data: \{ status: 'processing'/);
  assert.match(nodeByName.get("Mark Issued").parameters.url, /Certificates/);
  assert.equal(workflow.nodes.some((node) => /Create Certificate Record/.test(node.name)), false);
});

test("certificate snapshots and a stable provider idempotency key drive fulfillment", () => {
  const serialized = JSON.stringify(workflow);
  assert.match(serialized, /legal_name_snapshot/);
  assert.match(serialized, /course_title_snapshot/);
  assert.match(serialized, /cpe_earned/);
  assert.match(JSON.stringify(nodeByName.get("Send Certificate Email")), /Idempotency-Key/);
  assert.match(JSON.stringify(nodeByName.get("Send Certificate Email")), /certificateId/);
});

test("external failures retry and converge on a sanitized failed status", () => {
  assert.equal(nodeByName.get("Send Certificate Email").maxTries, 3);
  assert.equal(nodeByName.get("Copy Template").maxTries, 3);
  const failureBody = nodeByName.get("Mark Failed").parameters.jsonBody;
  assert.match(failureBody, /certificate_worker_error/);
  assert.doesNotMatch(failureBody, /\$json\.error|stack|token/i);
});

test("hourly reconciliation repairs missing and stuck work before replaying pending IDs", () => {
  const serialized = JSON.stringify(reconciliation);
  assert.match(serialized, /certificates\/reconcile/);
  assert.match(serialized, /pendingCertificateIds/);
  assert.match(serialized, /APzyGskMoXRCHBtH/);
});
