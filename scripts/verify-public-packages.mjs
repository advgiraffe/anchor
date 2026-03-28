import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packagePaths = [
  "packages/core/package.json",
  "packages/cli/package.json",
];

const failures = [];

for (const relativePath of packagePaths) {
  const absolutePath = resolve(process.cwd(), relativePath);
  const raw = readFileSync(absolutePath, "utf8");
  const pkg = JSON.parse(raw);

  if (!pkg.name || typeof pkg.name !== "string" || !pkg.name.startsWith("@")) {
    failures.push(`${relativePath}: expected scoped package name, got '${pkg.name ?? "<missing>"}'`);
  }

  const access = pkg.publishConfig?.access;
  if (access !== "public") {
    failures.push(`${relativePath}: publishConfig.access must be 'public'`);
  }
}

if (failures.length > 0) {
  console.error("Public package verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Public package verification passed.");
