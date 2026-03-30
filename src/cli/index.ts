#!/usr/bin/env node
// ============================================================
// cli/index.ts — CLI entrypoint for FC Optimizer
//
// Usage:
//   node dist/cli/index.js --input club.csv
//   node dist/cli/index.js --input club.csv --mode balanced --bench --verbose
//   node dist/cli/index.js --input club.csv --formation 4-3-3 --json
// ============================================================

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parseCSV } from '../adapters/index.js';
import { getFormations } from '../formations/index.js';
import { FC25ChemistryEngine } from '../chemistry/fc25.js';
import { SCORING_PRESETS, applyConfigOverrides } from '../scorer/index.js';
import { findBestLineups } from '../optimizer/index.js';
import { explainLineup, generateSwapSuggestions, buildAlternatives, suggestBench } from '../explainer/index.js';
import type { OptimizationMode, ConfigFile, ScoringConfig } from '../types/index.js';
import { printResult, printJSON } from './printer.js';

const program = new Command();

program
  .name('fc-optimizer')
  .description('EA Sports FC — Best XI optimizer CLI')
  .version('1.0.0');

program
  .requiredOption('-i, --input <path>', 'Path to CSV file with club players')
  .option('-m, --mode <mode>', 'Optimization mode: max-chem | balanced | max-rating | meta', 'balanced')
  .option('-f, --formation <name>', 'Force a specific formation (e.g. 4-3-3)')
  .option('-t, --top <n>', 'Number of top lineups to show', '3')
  .option('-c, --candidate-limit <n>', 'Max candidates per slot (default 15)', '15')
  .option('--bench', 'Show bench suggestions')
  .option('--verbose', 'Show detailed chemistry breakdown per player')
  .option('--json', 'Output structured JSON')
  .option('--config <path>', 'Path to JSON scoring config override file');

program.parse(process.argv);
const opts = program.opts();

// ----------------------------------------------------------
// Main pipeline
// ----------------------------------------------------------

async function main() {
  const startMs = Date.now();

  // 1. Load optional config file
  let configOverrides: Partial<ScoringConfig> = {};
  if (opts.config) {
    const configPath = path.resolve(opts.config);
    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found: ${configPath}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ConfigFile;
    if (raw.scoringOverrides) configOverrides = raw.scoringOverrides;
  }

  // 2. Validate mode
  const validModes: OptimizationMode[] = ['max-chem', 'balanced', 'max-rating', 'meta'];
  const mode = opts.mode as OptimizationMode;
  if (!validModes.includes(mode)) {
    console.error(`Invalid mode: ${opts.mode}. Must be one of: ${validModes.join(', ')}`);
    process.exit(1);
  }

  // 3. Parse CSV
  if (!opts.json) process.stdout.write(`Parsing ${opts.input}...\n`);
  let parseResult;
  try {
    parseResult = parseCSV(path.resolve(opts.input));
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  const { players, skippedRows, detectedFormat, warnings } = parseResult;

  if (!opts.json) {
    console.log(`Format detected: ${detectedFormat}`);
    console.log(`Players loaded: ${players.length} (${skippedRows} skipped)`);
    if (warnings.length > 0) {
      warnings.forEach(w => console.warn(`  ⚠ ${w}`));
    }
  }

  if (players.length < 11) {
    console.error(`Not enough players to field a team (${players.length} loaded, need at least 11)`);
    process.exit(1);
  }

  // 4. Determine formations to search
  const formationNames = opts.formation ? [opts.formation] : undefined;
  const formations = getFormations(formationNames);
  if (formations.length === 0) {
    console.error(`Unknown formation: ${opts.formation}`);
    process.exit(1);
  }

  // 5. Build scoring config
  const baseConfig = SCORING_PRESETS[mode];
  const config = applyConfigOverrides(baseConfig, configOverrides);

  // 6. Run optimizer
  if (!opts.json) process.stdout.write(`Searching best XI (mode: ${mode}, ${formations.length} formation(s))...\n`);

  const chemEngine = new FC25ChemistryEngine();
  const candidateLimit = Math.max(5, parseInt(opts.candidateLimit, 10) || 15);
  const topN = Math.max(1, parseInt(opts.top, 10) || 3);

  const optimizerResult = findBestLineups(players, {
    mode,
    config,
    chemEngine,
    formations,
    candidateLimit,
    topN: topN + 2, // fetch a few extra for swap analysis
  });

  const { rankedLineups, formationsTried, formationsSkipped } = optimizerResult;

  if (rankedLineups.length === 0) {
    console.error('No valid lineup found. Check that enough players cover all required positions.');
    process.exit(1);
  }

  const best = rankedLineups[0];

  // 7. Generate explanations
  const alternatives = buildAlternatives(rankedLineups, best.score).slice(0, topN - 1);

  const explanation = explainLineup(
    best.lineup,
    best.score,
    best.chemistry,
    mode,
    alternatives,
  );

  // 8. Swap suggestions
  const swapSuggestions = generateSwapSuggestions(
    best.lineup,
    best.score,
    best.chemistry,
    players,
    chemEngine,
    config,
  );

  // 9. Bench
  const bench = opts.bench ? suggestBench(players, best.lineup) : [];

  const durationMs = Date.now() - startMs;

  const result = {
    mode,
    bestLineup: best.lineup,
    bestScore: best.score,
    bestChemistry: best.chemistry,
    alternatives,
    swapSuggestions,
    bench,
    explanation,
    durationMs,
    meta: {
      playersLoaded: players.length,
      formationsTried,
      formationsSkipped,
      detectedFormat,
    },
  };

  // 10. Output
  if (opts.json) {
    printJSON(result);
  } else {
    printResult(result, { verbose: !!opts.verbose, showBench: !!opts.bench, topN });
    console.log(`\nDone in ${durationMs}ms`);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
