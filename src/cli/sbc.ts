#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parseCSV } from '../adapters/index.js';
import { parseSbcRequirements } from '../sbc/parser.js';
import { CHATGPT_SBC_PROMPT } from '../sbc/prompt.js';
import { solveSbc } from '../sbc/solver.js';
import { printJSON } from './printer.js';

const program = new Command();

program
  .name('fc-optimizer-sbc')
  .description('EA Sports FC — SBC solver CLI')
  .version('1.0.0')
  .option('-i, --input <path>', 'Path to CSV file with club players')
  .option('-r, --requirements <text>', 'Inline SBC requirements text')
  .option('--requirements-file <path>', 'Path to a requirements text file')
  .option('--candidate-pools <sizes>', 'Comma-separated heuristic pool sizes, e.g. 32,48,64,80')
  .option('--json', 'Output structured JSON')
  .option('--print-chatgpt-prompt', 'Print the manual ChatGPT prompt and exit');

program.parse(process.argv);
const opts = program.opts();

function parseCandidatePools(raw?: string): number[] | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map(part => parseInt(part.trim(), 10))
    .filter((value): value is number => !Number.isNaN(value) && value >= 16);
}

function loadRequirementsText(): string {
  if (opts.requirements) return opts.requirements;
  if (opts.requirementsFile) {
    const requirementsPath = path.resolve(opts.requirementsFile);
    if (!fs.existsSync(requirementsPath)) {
      throw new Error(`Requirements file not found: ${requirementsPath}`);
    }
    return fs.readFileSync(requirementsPath, 'utf-8');
  }
  throw new Error('Provide either --requirements or --requirements-file');
}

function printResult(result: ReturnType<typeof solveSbc>): void {
  if (!result.solution) {
    console.log('\nNo valid SBC solution found.');
    if (result.warnings.length > 0) {
      console.log('');
      result.warnings.forEach(warning => console.log(`Warning: ${warning}`));
    }
    return;
  }

  const { solution } = result;

  console.log('\n' + '═'.repeat(88));
  console.log(`  FC OPTIMIZER - SBC SOLVER`);
  console.log('═'.repeat(88));
  console.log(`  Challenge     : ${result.challenge.name ?? 'Unnamed SBC'}`);
  console.log(`  Team Rating   : ${solution.teamRating}${result.challenge.minTeamRating !== undefined ? ` (need ${result.challenge.minTeamRating})` : ''}`);
  console.log(`  Chemistry     : ${solution.chemistry}${result.challenge.minChemistry !== undefined ? ` (need ${result.challenge.minChemistry})` : ''}`);
  console.log(`  Keep Value    : ${solution.keepValue.toFixed(1)}   (lower is cheaper to submit)`);
  console.log(`  Search Scope  : ${result.candidatePoolSize}/${result.searchedPlayers} eligible cards, ${result.iterations} iterations`);

  console.log('\n  Players to submit');
  console.log('  ' + '─'.repeat(84));
  for (const card of solution.players) {
    const tags = [
      card.quality,
      card.rarity !== 'unknown' ? card.rarity : null,
      card.program !== 'base' ? card.program : null,
    ]
      .filter(Boolean)
      .join(', ');

    console.log(
      `  ${String(card.player.rating).padStart(2)}  ${card.player.name.padEnd(24)}` +
      `${card.player.nation.padEnd(18)} ${card.player.league.padEnd(20)} ${card.player.club.padEnd(22)} ` +
      `[${tags}] cost=${card.keepValue.toFixed(1)}`,
    );
  }

  console.log('\n  Constraint check');
  console.log('  ' + '─'.repeat(84));
  for (const status of solution.statuses) {
    const icon = status.ok ? 'OK ' : 'NO ';
    console.log(`  ${icon} ${status.label} -> ${status.actual} / ${status.expected}`);
  }

  console.log('\n  Why this squad');
  console.log('  ' + '─'.repeat(84));
  solution.explanation.forEach(line => console.log(`  ${line}`));

  if (result.warnings.length > 0) {
    console.log('\n  Warnings');
    console.log('  ' + '─'.repeat(84));
    result.warnings.forEach(warning => console.log(`  ${warning}`));
  }

  console.log('\n' + '═'.repeat(88));
}

async function main(): Promise<void> {
  if (opts.printChatgptPrompt) {
    console.log(CHATGPT_SBC_PROMPT);
    return;
  }

  if (!opts.input) {
    throw new Error('Missing required option --input');
  }

  const parseResult = parseCSV(path.resolve(opts.input));
  const requirementsText = loadRequirementsText();
  const challenge = parseSbcRequirements(requirementsText);
  const result = solveSbc(parseResult.players, challenge, {
    candidatePoolSizes: parseCandidatePools(opts.candidatePools),
  });

  const payload = {
    challenge,
    solution: result.solution,
    meta: {
      eligibleCards: result.searchedPlayers,
      candidatePoolSize: result.candidatePoolSize,
      iterations: result.iterations,
      parsedPlayers: parseResult.players.length,
      skippedRows: parseResult.skippedRows,
      detectedFormat: parseResult.detectedFormat,
      warnings: result.warnings,
    },
  };

  if (opts.json) {
    printJSON(payload);
    return;
  }

  console.log(`Parsing ${opts.input}...`);
  console.log(`Format detected: ${parseResult.detectedFormat}`);
  console.log(`Players loaded: ${parseResult.players.length} (${parseResult.skippedRows} skipped)`);
  printResult(result);
}

main().catch(err => {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
});
