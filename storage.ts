/**
 * Durable JSON files for bookings, videos and site media.
 *
 * These used to be written with a bare fs.writeFileSync, and bookings were read
 * back with "on any error, return the demo seed data". Together those meant one
 * interrupted write could erase every real booking:
 *
 *   1. The process is killed mid-write — a deploy, a crash, the host recycling
 *      the container — and bookings.json is left truncated.
 *   2. The next read fails to parse, and silently returns the demo bookings.
 *   3. The next booking appends to the demo list and saves it over the file.
 *
 * Every real customer gone, replaced by fake ones that look plausible in the
 * owner portal. This file closes each step:
 *
 *   - Writes are atomic: a temp file is written, flushed to disk, then renamed
 *     over the original. Rename is atomic, so a reader sees the old file or the
 *     new one — never half of either.
 *   - Before each write the current file is copied to a rolling backup.
 *   - A file that will not parse is recovered from the newest backup that does.
 *     If none does, reading THROWS. Refusing to serve is recoverable; quietly
 *     serving the wrong data and then saving over the right data is not.
 *
 * What this does NOT protect against: the host wiping the disk. Backups live
 * beside the file, so a redeploy that discards the container discards them too.
 * That needs the bookings in a real database — see the handoff doc.
 */
import fs from "fs";
import path from "path";

export interface ReadResult<T> {
  data: T;
  /** Where the data came from — anything but "file" or "missing" is worth an alert. */
  source: "file" | "missing" | `backup:${string}`;
}

const backupDir = (file: string) => path.join(path.dirname(file), "backups");
const backupPrefix = (file: string) => path.basename(file, ".json") + ".";

/** Newest first. */
export function listBackups(file: string): string[] {
  const dir = backupDir(file);
  if (!fs.existsSync(dir)) return [];
  const prefix = backupPrefix(file);
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .reverse();
}

export function writeJsonAtomic(file: string, data: unknown, opts: { backups?: number } = {}): void {
  const keep = opts.backups ?? 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });

  // Snapshot what is there now, before replacing it. Only a file that parses
  // is worth keeping — backing up a corrupt file would push a good backup out.
  if (keep > 0 && fs.existsSync(file)) {
    try {
      JSON.parse(fs.readFileSync(file, "utf-8"));
      const dir = backupDir(file);
      fs.mkdirSync(dir, { recursive: true });
      // Sortable, filesystem-safe, and unique even within one millisecond.
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const name = `${backupPrefix(file)}${stamp}-${process.hrtime.bigint()}.json`;
      fs.copyFileSync(file, path.join(dir, name));
      for (const old of listBackups(file).slice(keep)) fs.rmSync(path.join(dir, old), { force: true });
    } catch {
      // The current file is already corrupt; keep the backups we have.
    }
  }

  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

export function readJsonWithRecovery<T>(
  file: string,
  opts: { whenMissing: T; valid: (v: unknown) => v is T }
): ReadResult<T> {
  if (!fs.existsSync(file)) return { data: opts.whenMissing, source: "missing" };

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (opts.valid(parsed)) return { data: parsed, source: "file" };
  } catch {
    /* fall through to the backups */
  }

  for (const name of listBackups(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(backupDir(file), name), "utf-8"));
      if (opts.valid(parsed)) return { data: parsed, source: `backup:${name}` };
    } catch {
      /* try the next one */
    }
  }

  throw new Error(
    `${path.basename(file)} is unreadable and no backup could be recovered. ` +
      `Refusing to substitute other data. Restore with: node scripts/restore-backup.mjs ${path.basename(file)}`
  );
}

/** Put a named backup back as the live file. The file it replaces is backed up first. */
export function restoreBackup(file: string, backupName: string, opts: { backups?: number } = {}): void {
  const src = path.join(backupDir(file), backupName);
  const data = JSON.parse(fs.readFileSync(src, "utf-8"));
  writeJsonAtomic(file, data, opts);
}
