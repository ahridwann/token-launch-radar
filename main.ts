// Token Radar (radar-8): the entrypoint for make.fun's token-radar-01 bounty.
//
// Reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores every
// pre-token protocol with the three-member Huber ensemble in lib/model.ts, ranks the board
// by EXPECTED value (fitted implied value times the peer token odds, also fitted from the
// snapshot at run time), writes the ranked board to /output/board.json, writes the
// dashboard's data to /output/data.js, copies dashboard/ and screenshots/ to /output, and
// writes /output/dossier.json with the vendored make.fun library.
//
// The program is deterministic: the same snapshot bytes always write the same output bytes,
// so the grader's two runs agree. It runs on Node 22 with the standard library only.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the dossier, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dash = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
);

const f = radar.fit;
const wf = f.walk_forward;
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} beyond the watchlist, ${radar.live_size} live set aside)\n` +
    `token radar: model ${radar.model_version}, ${f.comps_n} comps, R² ${f.r_squared.toFixed(3)}, leave-one-out median ×${f.loo_median_factor.toFixed(3)}, ${Math.round(f.loo_within_2x * 100)}% within 2×, log RMSE ${f.loo_log_rmse.toFixed(3)}\n` +
    `token radar: betas M1 [${f.members[0]!.beta.map((b) => b.toFixed(4)).join(', ')}] M2 [${f.members[1]!.beta.map((b) => b.toFixed(4)).join(', ')}] M3 [${f.members[2]!.beta.map((b) => b.toFixed(4)).join(', ')}]\n` +
    `token radar: odds overall ${f.odds.overall_rate.toFixed(4)} (${f.odds.overall_k}/${f.odds.overall_n}), range all ${f.odds.odds_min.toFixed(4)}-${f.odds.odds_max.toFixed(4)}, board ${radar.odds_board_min.toFixed(4)}-${radar.odds_board_max.toFixed(4)}\n` +
    `token radar: walk-forward forward ×${wf.forward.median_factor.toFixed(3)} (${Math.round(wf.forward.within_2x * 100)}% within 2×, RMSE ${wf.forward.log_rmse.toFixed(3)}, fit ${wf.forward.fit_n} test ${wf.forward.test_n}), reverse ×${wf.reverse.median_factor.toFixed(3)} (${Math.round(wf.reverse.within_2x * 100)}% within 2×, RMSE ${wf.reverse.log_rmse.toFixed(3)}, fit ${wf.reverse.fit_n} test ${wf.reverse.test_n})\n` +
    `token radar: top expected ${board[0]!.slug} $${board[0]!.implied_value_usd.toLocaleString('en-US')} (raw $${board[0]!.raw_implied_value_usd.toLocaleString('en-US')} x odds ${board[0]!.odds})\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dash.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
