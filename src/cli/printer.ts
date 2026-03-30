// ============================================================
// cli/printer.ts — Formatted terminal output (chalk v4 / CommonJS)
// ============================================================

import chalk from 'chalk';
import type {
  Lineup,
  LineupScore,
  ChemistryBreakdown,
  SwapSuggestion,
  BenchSuggestion,
  AlternativeLineup,
  OptimizationMode,
} from '../types/index.js';

const c = chalk;

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function chemBar(chem: number, max = 33): string {
  const filled = Math.round((chem / max) * 20);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const pct = Math.round((chem / max) * 100);
  const label = `[${bar}] ${chem}/${max}`;
  if (pct >= 90) return c.green(label);
  if (pct >= 70) return c.yellow(label);
  return c.red(label);
}

function playerChemIcon(chem: number): string {
  if (chem === 3) return c.green('●●●');
  if (chem === 2) return c.yellow('●●○');
  if (chem === 1) return c.yellow('●○○');
  return c.red('○○○');
}

function ratingColor(r: number): string {
  const s = r.toString().padStart(2);
  if (r >= 90) return c.magenta(s);
  if (r >= 85) return c.yellow(s);
  if (r >= 80) return c.cyan(s);
  return c.white(s);
}

function pad(s: string, n: number): string {
  // Strip ANSI codes for length calculation
  const plain = s.replace(/\x1B\[[0-9;]*m/g, '');
  const padding = Math.max(0, n - plain.length);
  return s + ' '.repeat(padding);
}

function section(title: string): void {
  const line = '─'.repeat(Math.max(0, 52 - title.length));
  console.log('\n' + c.bold(c.cyan(`── ${title} ${line}`)));
}

// ----------------------------------------------------------
// Lineup table
// ----------------------------------------------------------

function printLineupTable(lineup: Lineup, chemistry: ChemistryBreakdown, verbose: boolean): void {
  const chemMap = new Map(chemistry.players.map(p => [p.playerId, p]));

  console.log(c.bold('\n  Slot         Player                          Rat  Chem  Nation / League'));
  console.log('  ' + '─'.repeat(80));

  for (const a of lineup.assignments) {
    const p = a.player;
    const bd = chemMap.get(p.id);
    const indChem = bd?.individualChem ?? 0;
    const chemStr = playerChemIcon(indChem);
    const cardTag = p.isIcon ? c.magenta(' [ICON]') : p.isHero ? c.yellow(' [HERO]') : '';
    const nameStr = p.name + cardTag;

    console.log(
      `  ${pad(c.cyan(a.slot.label ?? a.slot.id), 13)}` +
      `${pad(nameStr, 33)}` +
      `${ratingColor(p.rating)}   ` +
      `${chemStr}  ` +
      `${c.gray(p.nation)} / ${c.gray(p.league)}`
    );

    if (verbose && bd && bd.notes.length > 0) {
      console.log(`               ${c.gray('→ ' + bd.notes.join(' · '))}`);
    }
  }
}

// ----------------------------------------------------------
// Main result printer
// ----------------------------------------------------------

export interface PrintOptions {
  verbose: boolean;
  showBench: boolean;
  topN: number;
}

export function printResult(
  result: {
    mode: OptimizationMode;
    bestLineup: Lineup;
    bestScore: LineupScore;
    bestChemistry: ChemistryBreakdown;
    alternatives: AlternativeLineup[];
    swapSuggestions: SwapSuggestion[];
    bench: BenchSuggestion[];
    explanation: string[];
    meta: Record<string, unknown>;
  },
  opts: PrintOptions,
): void {
  const { bestLineup, bestScore, bestChemistry, alternatives, swapSuggestions, bench, explanation, meta } = result;

  console.log('\n' + '═'.repeat(88));
  console.log(c.bold(c.green('  FC OPTIMIZER - BEST STARTING XI')));
  console.log('═'.repeat(88));

  // Summary
  section('SUMMARY');
  console.log(`  Formation  : ${c.bold(bestLineup.formation.name)}`);
  console.log(`  Mode       : ${c.bold(result.mode)}`);
  console.log(`  Chemistry  : ${chemBar(bestScore.totalChemistry)}`);
  console.log(`  Avg Rating : ${ratingColor(Math.round(bestScore.averageRating))}   (Total: ${c.bold(String(bestScore.totalRating))})`);
  console.log(`  Strength   : ${bestScore.strengthScore.toFixed(1)}`);
  console.log(`  Formations : ${meta.formationsTried} searched, ${meta.formationsSkipped} skipped (no eligible players)`);

  // Starting XI
  section('STARTING XI');
  printLineupTable(bestLineup, bestChemistry, opts.verbose);

  // Explanation
  section('WHY THIS LINEUP');
  for (const line of explanation) {
    console.log(`  ${line}`);
  }

  // Swap suggestions
  if (swapSuggestions.length > 0) {
    section('SWAP SUGGESTIONS');
    console.log(c.gray('  Potential upgrades and trade-offs:\n'));
    for (const s of swapSuggestions.slice(0, 8)) {
      const delta = s.chemDelta > 0
        ? c.green(`+${s.chemDelta} chem`)
        : s.chemDelta < 0
          ? c.red(`${s.chemDelta} chem`)
          : c.gray('±0 chem');
      const ratDelta = s.ratingDelta > 0
        ? c.green(`+${s.ratingDelta} rat`)
        : s.ratingDelta < 0
          ? c.red(`${s.ratingDelta} rat`)
          : c.gray('±0 rat');

      console.log(
        `  ${pad(c.cyan(s.slotId), 8)}` +
        `${pad(s.currentPlayer.name, 22)} → ` +
        `${pad(c.bold(s.alternativePlayer.name), 22)}` +
        `[${delta}, ${ratDelta}]`
      );
    }
  }

  // Alternatives
  if (alternatives.length > 0) {
    section(`ALTERNATIVE LINEUPS (top ${alternatives.length + 1})`);
    for (const alt of alternatives.slice(0, opts.topN - 1)) {
      console.log(
        `  #${alt.rank}  ${c.bold(alt.lineup.formation.name.padEnd(10))}` +
        `Chem: ${chemBar(alt.score.totalChemistry)}   ` +
        `Avg: ${alt.score.averageRating}   ` +
        `[${c.yellow(alt.diffFromBest)}]`
      );
    }
  }

  // Bench
  if (opts.showBench && bench.length > 0) {
    section('BENCH (7 PLAYERS)');
    for (const b of bench) {
      const role = { GK: '🧤', DEF: '🛡 ', MID: '⚙ ', ATT: '⚡' }[b.role] ?? '  ';
      console.log(
        `  ${role}  ${pad(b.player.name, 24)}` +
        `${ratingColor(b.player.rating)}   ` +
        `${c.gray(b.reason)}`
      );
    }
  }

  console.log('\n' + '═'.repeat(88));
}

// ----------------------------------------------------------
// JSON output
// ----------------------------------------------------------

export function printJSON(result: unknown): void {
  console.log(JSON.stringify(result, null, 2));
}
