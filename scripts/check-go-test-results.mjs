import { readFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Provide the go test -json result file.");

const events = readFileSync(input, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line));

const skipped = events.filter((event) => event.Action === "skip" && event.Test);
const failures = events.filter((event) => event.Action === "fail");
const integrationCases = events.filter(
  (event) => event.Action === "pass" && event.Test?.includes("Integration"),
);

for (const event of skipped) console.error(`Skipped required test: ${event.Package}/${event.Test}`);
for (const event of failures) console.error(`Failed test/package: ${event.Package}/${event.Test ?? ""}`);

if (skipped.length || failures.length || integrationCases.length === 0) {
  console.error("Required integration tests must execute and pass; skipped cases need an explicit separate test suite.");
  process.exitCode = 1;
} else {
  console.log(`${integrationCases.length} integration cases passed; no tests were skipped.`);
}
