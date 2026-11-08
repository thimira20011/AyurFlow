import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { checksum, command, connection, fingerprint, maximumBytes } from "./common.mjs";

const output = path.resolve(process.argv[2] || "");
let temporary;
const children = [];
try {
  if (!process.argv[2]) throw new Error("Supply a new backup output directory.");
  const source = connection(process.env.BACKUP_DATABASE_URL);
  if (!/^age1[0-9a-z]{58}$/.test(process.env.BACKUP_RECIPIENT || "")) throw new Error("Set BACKUP_RECIPIENT to the holder's age public key.");
  await mkdir(path.dirname(output), { recursive: true });
  temporary = await mkdtemp(path.join(path.dirname(output), ".backup-"));
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const dump = command("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--compress=6"], source.href);
  const encrypt = command("age", ["--encrypt", "--recipient", process.env.BACKUP_RECIPIENT], undefined, "pipe");
  children.push(dump.child, encrypt.child);
  let bytes = 0;
  const limit = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    callback(bytes > maximumBytes ? new Error("Encrypted backup exceeds the approved 48 MiB limit.") : null, chunk);
  } });
  const archive = path.join(temporary, "database.dump.age");
  const tasks = [
    pipeline(dump.child.stdout, encrypt.child.stdin),
    pipeline(encrypt.child.stdout, limit, createWriteStream(archive, { mode: 0o600, flags: "wx" })),
    dump.done, encrypt.done,
  ];
  try { await Promise.all(tasks); } catch (error) {
    for (const child of children) if (child.exitCode === null) child.kill();
    await Promise.allSettled(tasks);
    throw error;
  }
  const size = (await stat(archive)).size;
  if (!size) throw new Error("Empty backup rejected.");
  const manifest = { version: 1, startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - started,
    source: fingerprint(source), bytes: size, sha256: await checksum(archive), format: "pg_dump-custom+age" };
  await writeFile(path.join(temporary, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  // A completed backup is published only after both processes succeed.
  await rename(temporary, output);
  temporary = undefined;
  console.log(`Encrypted backup complete (${size} bytes).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
