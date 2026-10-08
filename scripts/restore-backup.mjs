#!/usr/bin/env node
/**
 * Put a data file back from one of its backups.
 *
 *   node scripts/restore-backup.mjs                          what can be restored
 *   node scripts/restore-backup.mjs bookings.json            its backups, newest first
 *   node scripts/restore-backup.mjs bookings.json --latest   restore the newest good one
 *   node scripts/restore-backup.mjs bookings.json <name>     restore that one
 *
 * Plain Node, no dependencies, no build step: this is for the moment something
 * has gone wrong, which is not the moment to find tsx is missing on the server.
 *
 * The file being replaced is itself backed up first, so a restore can be undone
 * the same way. Safe to run while the site is up — the server re-reads the file
 * on every request — though stopping it first rules out a booking landing
 * mid-restore.
 */
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

const [target, choice] = process.argv.slice(2);

function backupsFor(file) {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const prefix = path.basename(file, ".json") + ".";
  return fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).sort().reverse();
}

function describe(fullPath) {
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const n = Array.isArray(data) ? `${data.length} records` : `${Object.keys(data).length} keys`;
    return { ok: true, label: n };
  } catch {
    return { ok: false, label: "UNREADABLE" };
  }
}

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

if (!target) {
  const files = fs.existsSync(BACKUP_DIR)
    ? [...new Set(fs.readdirSync(BACKUP_DIR).map((f) => f.split(".")[0] + ".json"))]
    : [];
  if (!files.length) {
    console.log(`No backups under ${BACKUP_DIR}.`);
    process.exit(0);
  }
  console.log("Files with backups:\n");
  for (const f of files) console.log(`  ${f}  (${backupsFor(f).length} backups)`);
  console.log("\nNext: node scripts/restore-backup.mjs <file>");
  process.exit(0);
}

const live = path.join(DATA_DIR, path.basename(target));
const list = backupsFor(live);

if (!choice) {
  const now = describe(live);
  console.log(`${path.basename(live)} now: ${fs.existsSync(live) ? now.label : "missing"}\n`);
  if (!list.length) {
    console.log("No backups for this file.");
    process.exit(1);
  }
  console.log("Backups, newest first:\n");
  for (const name of list) {
    const d = describe(path.join(BACKUP_DIR, name));
    console.log(`  ${d.ok ? " " : "!"} ${name}  ${d.label}`);
  }
  console.log(`\nRestore: node scripts/restore-backup.mjs ${path.basename(live)} --latest   (or a name above)`);
  process.exit(0);
}

const pick =
  choice === "--latest" ? list.find((n) => describe(path.join(BACKUP_DIR, n)).ok) : list.find((n) => n === choice);

if (!pick) {
  console.error(choice === "--latest" ? "No readable backup found." : `No backup named ${choice}.`);
  process.exit(1);
}

const source = path.join(BACKUP_DIR, pick);
const text = fs.readFileSync(source, "utf-8");
JSON.parse(text); // refuse to restore something that does not parse

// Keep what is being replaced, so this restore can itself be undone.
if (fs.existsSync(live)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const saved = `${path.basename(live, ".json")}.${stamp}-before-restore.json`;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.copyFileSync(live, path.join(BACKUP_DIR, saved));
  console.log(`Kept the current file as backups/${saved}`);
}

writeAtomic(live, text);
console.log(`Restored ${path.basename(live)} from ${pick} — ${describe(live).label}.`);
