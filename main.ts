// Token Radar's program: one snapshot in, one radar out, the same bytes every run.
//
// It reads the sealed snapshot at $MAKEFUN_INPUT_DIR/snapshot.json (or the kit's
// input/snapshot.json), derives the board from the snapshot's own figures (lib/model.ts), and
// writes the outputs the gate reads:
//
//   /output/board.json       the ranked board, 100..4000 rows
//   /output/data.js          the dashboard's dataset, as one script
//   /output/dashboard/       the dashboard's page (index.html, app.css, app.js)
//   /output/screenshots/     the three screenshots of the dashboard
//   /output/dossier.json     the dossier, written by the kit's buildDossier
//
// No network, no clock, no randomness: the same snapshot gives the same files, byte for byte.

import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, boardIssue, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier, canonicalJson } from './vendor/makefun-board.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? join(ROOT, '../token-radar-01-kit/token-radar-01-kit/input');

/** The scorer's own caps (the starter's main.ts): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Where the snapshot comes from, in order: the trial env, then the kit's own input. */
function snapshotPath(): string {
  const fromEnv = join(INPUT_DIR, 'snapshot.json');
  if (existsSync(fromEnv)) return fromEnv;
  const fromKit = join(ROOT, '../token-radar-01-kit/token-radar-01-kit/input/snapshot.json');
  if (existsSync(fromKit)) return fromKit;
  throw new Error(`snapshot.json not found in ${fromEnv} or ${fromKit}`);
}

/** The files the program writes, and their sizes, so a run's output can be checked at a glance. */
async function listOutputs(dir: string): Promise<Array<{ file: string; size: number }>> {
  const out: Array<{ file: string; size: number }> = [];
  async function walk(d: string, prefix: string): Promise<void> {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(p, rel);
      else out.push({ file: rel, size: (await stat(p)).size });
    }
  }
  await walk(dir, '');
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

/** The program's whole run: read the snapshot, build the board, write the outputs. */
async function main(): Promise<void> {
  const snapshot = parseSnapshot(await readFile(snapshotPath(), 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new Error(`the board fails its own check: ${issue}`);
  if (board.length < 100) throw new Error(`the board holds ${board.length} rows, below the 100-row floor`);

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'board.json'), `${canonicalJson({ rows: board })}`);
  await writeFile(join(OUT, 'data.js'), dataScript(radar));
  await cp(join(ROOT, 'dashboard'), join(OUT, 'dashboard'), { recursive: true });
  await cp(join(ROOT, 'screenshots'), join(OUT, 'screenshots'), { recursive: true });
  const shots = (await readdir(join(OUT, 'screenshots'))).filter((n) => !n.startsWith('.'));
  if (shots.length < 3) throw new Error(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  for (const name of shots) {
    if (!IMAGE_NAME.test(name)) throw new Error(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
  }
  await writeFile(join(OUT, 'dossier.json'), buildDossier(OUT, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: DASHBOARD_CAPS }));

  const outputs = await listOutputs(OUT);
  console.log(`board rows: ${board.length} (${radar.watchlist_size} watchlist, ${radar.early_size} early)`);
  console.log(`model: ${radar.model_version}, global median ${radar.model.global_median}, ${Object.keys(radar.multiples).length} category multiples`);
  console.log(`top row: ${board[0]!.name} ${board[0]!.implied_value_usd.toLocaleString('en-US')} USD`);
  for (const o of outputs) console.log(`  ${o.file}: ${o.size} bytes`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
