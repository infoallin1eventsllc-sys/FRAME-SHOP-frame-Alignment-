import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { writeJsonAtomic, readJsonWithRecovery, listBackups } from '../storage';

/**
 * Bookings are the business. These cover the ways the file holding them used
 * to be lost, and prove it can be put back.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const SEED = [{ id: 'demo', name: 'Demo Customer' }];

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-storage-'));
  return path.join(dir, 'bookings.json');
}

test.describe('Durable storage', () => {
  test('a write replaces the file whole and leaves nothing half-written behind', () => {
    const file = tempFile();
    writeJsonAtomic(file, [{ id: 'a' }]);
    writeJsonAtomic(file, [{ id: 'a' }, { id: 'b' }]);
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toHaveLength(2);
    expect(fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  test('a truncated file is recovered from backup — not replaced with demo data', () => {
    // The original failure: a write cut short, then the next read returned the
    // demo seed, and the next save wrote the demo seed over the real bookings.
    const file = tempFile();
    const real = [{ id: 'r1', name: 'Real Customer' }, { id: 'r2', name: 'Another' }];
    writeJsonAtomic(file, real, { backups: 5 });
    writeJsonAtomic(file, [...real, { id: 'r3' }], { backups: 5 });

    fs.writeFileSync(file, '[{"id":"r1","name":"Real Cu'); // killed mid-write

    const { data, source } = readJsonWithRecovery(file, { whenMissing: SEED, valid: isArray });
    expect(source).toMatch(/^backup:/);
    expect(data).toEqual(real);
    expect(JSON.stringify(data)).not.toContain('Demo Customer');
  });

  test('with nothing to recover from, reading refuses rather than inventing data', () => {
    const file = tempFile();
    fs.writeFileSync(file, '{ not json');
    expect(() => readJsonWithRecovery(file, { whenMissing: SEED, valid: isArray })).toThrow(/Refusing to substitute/);
  });

  test('a file that has never existed starts from the seed', () => {
    const { data, source } = readJsonWithRecovery(tempFile(), { whenMissing: SEED, valid: isArray });
    expect(source).toBe('missing');
    expect(data).toEqual(SEED);
  });

  test('backups are capped, keeping the newest', () => {
    const file = tempFile();
    for (let i = 0; i < 12; i++) writeJsonAtomic(file, [{ id: `v${i}` }], { backups: 5 });
    const kept = listBackups(file);
    expect(kept).toHaveLength(5);
    // The newest backup is the state before the final write.
    const newest = JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'backups', kept[0]), 'utf-8'));
    expect(newest).toEqual([{ id: 'v10' }]);
  });

  test('a corrupt file is never backed up over a good backup', () => {
    const file = tempFile();
    writeJsonAtomic(file, [{ id: 'good' }], { backups: 1 });
    writeJsonAtomic(file, [{ id: 'good' }, { id: 'also-good' }], { backups: 1 });
    fs.writeFileSync(file, 'garbage');
    writeJsonAtomic(file, [{ id: 'new' }], { backups: 1 }); // must not snapshot the garbage
    const [only] = listBackups(file);
    expect(fs.readFileSync(path.join(path.dirname(file), 'backups', only), 'utf-8')).not.toContain('garbage');
  });

  test('the restore script puts a corrupted file back', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-restore-'));
    const file = path.join(root, 'data', 'bookings.json');
    writeJsonAtomic(file, [{ id: 'keep-me' }], { backups: 5 });
    writeJsonAtomic(file, [{ id: 'keep-me' }, { id: 'and-me' }], { backups: 5 });
    fs.writeFileSync(file, 'truncat');

    const script = path.resolve(HERE, '..', 'scripts', 'restore-backup.mjs');
    const out = execFileSync('node', [script, 'bookings.json', '--latest'], { cwd: root, encoding: 'utf-8' });

    expect(out).toMatch(/Restored bookings\.json/);
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toEqual([{ id: 'keep-me' }]);
    // What it replaced is kept, so the restore can be undone.
    expect(listBackups(file).some((n) => n.includes('before-restore'))).toBe(true);
  });
});

/** Against the running server and its real data file. */
test.describe('Bookings survive a damaged file', () => {
  const DATA = path.resolve(HERE, '..', 'data', 'bookings.json');

  test('a corrupted bookings file is recovered, and a new booking does not erase the real ones', async ({ request }) => {
    const create = (name: string) =>
      request.post('/api/bookings', {
        data: { name, phone: '8325550177', email: 'survive@example.com', bikeMake: 'Indian', bikeModel: 'Chief' },
      });

    // Two writes, so the second leaves a backup holding the first.
    const a = (await (await create('Survivor A')).json()).booking;
    const b = (await (await create('Survivor B')).json()).booking;
    const snapshot = fs.readFileSync(DATA, 'utf-8');

    try {
      fs.writeFileSync(DATA, snapshot.slice(0, Math.floor(snapshot.length / 2))); // cut mid-write

      const c = (await (await create('After The Crash')).json()).booking;
      const all = (await (await request.get('/api/bookings')).json()).bookings.map((x: any) => x.ticketNumber);

      // Before the fix, A was gone and the list was demo data plus C.
      expect(all).toContain(a.ticketNumber);
      expect(all).toContain(c.ticketNumber);
      // B lived only in the file that was cut; the newest backup predates it.
      // Losing the one write that was interrupted is the honest limit here.
      void b;
    } finally {
      fs.writeFileSync(DATA, snapshot);
      for (const t of [a, b]) await request.delete(`/api/bookings/${t.id}`).catch(() => {});
      const left = (await (await request.get('/api/bookings')).json()).bookings;
      for (const x of left.filter((x: any) => x.name === 'After The Crash')) await request.delete(`/api/bookings/${x.id}`);
    }
  });
});

test.describe('Many customers at once', () => {
  test('twenty-five simultaneous bookings all land, each with its own ticket', async ({ request }) => {
    const N = 25;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        request.post('/api/bookings', {
          data: { name: `Rush ${i}`, phone: '8325550166', email: 'rush@example.com', bikeMake: 'Harley-Davidson', bikeModel: 'Softail' },
        })
      )
    );
    const made = await Promise.all(results.map(async (r) => ({ status: r.status(), booking: (await r.json()).booking })));

    try {
      expect(made.filter((m) => m.status === 201)).toHaveLength(N);
      const tickets = made.map((m) => m.booking.ticketNumber);
      expect(new Set(tickets).size).toBe(N);

      // Every one of them is actually in the file — none lost to a race.
      const stored = new Set((await (await request.get('/api/bookings')).json()).bookings.map((b: any) => b.ticketNumber));
      for (const t of tickets) expect(stored.has(t), `${t} missing from storage`).toBe(true);
    } finally {
      for (const m of made) if (m.booking?.id) await request.delete(`/api/bookings/${m.booking.id}`);
    }
  });

  test('the same booking sent twice is saved once', async ({ request }) => {
    const body = {
      name: 'Double Tap', phone: '8325550155', email: 'double@example.com',
      bikeMake: 'Indian', bikeModel: 'Scout', idempotencyKey: `spec-${Date.now()}`,
    };
    const [first, second] = await Promise.all([
      request.post('/api/bookings', { data: body }),
      request.post('/api/bookings', { data: body }),
    ]);
    const one = (await first.json()).booking;
    const two = (await second.json()).booking;
    // Matched on this run's own key, not on the name, so a record left over
    // from any earlier run cannot be mistaken for a duplicate made by this one.
    const mine = async () =>
      (await (await request.get('/api/bookings')).json()).bookings.filter((b: any) => b.idempotencyKey === body.idempotencyKey);
    try {
      expect(one.ticketNumber).toBe(two.ticketNumber);
      expect(await mine()).toHaveLength(1);
    } finally {
      for (const b of await mine()) await request.delete(`/api/bookings/${b.id}`);
    }
  });
});
