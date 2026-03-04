import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const suites = [
  path.join(repoRoot, "server/tests/integration/auth-http.integration.test.ts"),
  path.join(repoRoot, "server/tests/integration/rbac.integration.test.ts"),
];

const MIN_AUTH_RBAC_TESTS = 8;

function countTests(source) {
  const matches = source.match(/\b(?:it|test)\s*\(/g);
  return matches?.length ?? 0;
}

let count = 0;
for (const suite of suites) {
  if (!fs.existsSync(suite)) continue;
  const source = fs.readFileSync(suite, "utf8");
  count += countTests(source);
}

if (count < MIN_AUTH_RBAC_TESTS) {
  console.error(
    `[auth-rbac-guard] Expected at least ${MIN_AUTH_RBAC_TESTS} tests across auth/RBAC integration suites, found ${count}.`
  );
  process.exit(1);
}

console.log(
  `[auth-rbac-guard] OK: ${count} tests across auth/RBAC integration suites (minimum ${MIN_AUTH_RBAC_TESTS}).`
);
