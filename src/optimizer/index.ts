// ============================================================
// optimizer/index.ts — Best XI search with branch-and-bound pruning
// ============================================================

import type {
  PlayerCard,
  Formation,
  Lineup,
  LineupSlotAssignment,
  ScoringConfig,
  OptimizationMode,
  LineupScore,
  ChemistryBreakdown,
} from '../types/index.js';
import type { ChemistryEngine } from '../types/index.js';
import { scoreLineup, compareScores } from '../scorer/index.js';

export interface SearchOptions {
  mode: OptimizationMode;
  config: ScoringConfig;
  chemEngine: ChemistryEngine;
  formations: Formation[];
  candidateLimit: number;
  topN: number;
}

export interface RankedLineup {
  lineup: Lineup;
  score: LineupScore;
  chemistry: ChemistryBreakdown;
}

// ----------------------------------------------------------
// Candidate precomputation
// ----------------------------------------------------------

interface SlotCandidates {
  slotIndex: number;
  candidates: PlayerCard[];
}

function buildCandidates(
  formation: Formation,
  players: PlayerCard[],
  limit: number,
): SlotCandidates[] | null {
  const result: SlotCandidates[] = [];
  for (let i = 0; i < formation.slots.length; i++) {
    const slot = formation.slots[i];
    const eligible = players
      .filter(p => p.positions.some(pos => slot.accepts.includes(pos)))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
    if (eligible.length === 0) return null;
    result.push({ slotIndex: i, candidates: eligible });
  }
  return result;
}

function sortByConstraint(slots: SlotCandidates[]): SlotCandidates[] {
  return [...slots].sort((a, b) => a.candidates.length - b.candidates.length);
}

// ----------------------------------------------------------
// Top-N collector
// ----------------------------------------------------------

class TopNCollector {
  private items: RankedLineup[] = [];
  constructor(private n: number, private mode: OptimizationMode) {}

  tryAdd(item: RankedLineup): void {
    if (this.items.length >= this.n) {
      const worst = this.items[this.items.length - 1];
      if (compareScores(item.score, worst.score, this.mode) <= 0) return;
    }
    this.items.push(item);
    this.items.sort((a, b) => -compareScores(a.score, b.score, this.mode));
    if (this.items.length > this.n) this.items.pop();
  }

  get results(): RankedLineup[] { return this.items; }

  worstFinalScore(): number {
    if (this.items.length < this.n) return -Infinity;
    return this.items[this.items.length - 1].score.finalScore;
  }
}

// ----------------------------------------------------------
// Backtracking search — per formation
// Hard cap: 50k iterations prevents runaway on large clubs
// ----------------------------------------------------------

const MAX_ITERS = 50_000;

function searchFormation(
  formation: Formation,
  sortedSlots: SlotCandidates[],
  chemEngine: ChemistryEngine,
  config: ScoringConfig,
  mode: OptimizationMode,
  collector: TopNCollector,
): void {
  const currentPlayers: (PlayerCard | null)[] = new Array(sortedSlots.length).fill(null);
  const usedIds = new Set<string>();
  let iters = 0;

  function backtrack(depth: number, ratingAccum: number): void {
    if (iters++ > MAX_ITERS) return;

    if (depth === sortedSlots.length) {
      // Reassemble in original formation slot order
      const assignments: LineupSlotAssignment[] = formation.slots.map((slot, fi) => {
        const si = sortedSlots.findIndex(s => s.slotIndex === fi);
        return { slot, player: currentPlayers[si]! };
      });
      const lineup: Lineup = { formation, assignments };
      const chem = chemEngine.calculateSquadChemistry(lineup);
      const score = scoreLineup(lineup, chem, config);
      collector.tryAdd({ lineup, score, chemistry: chem });
      return;
    }

    // Optimistic upper bound: best available rating for each remaining slot
    let upperRating = ratingAccum;
    for (let i = depth; i < sortedSlots.length; i++) {
      const best = sortedSlots[i].candidates.find(p => !usedIds.has(p.id));
      upperRating += best?.rating ?? 0;
    }

    // Pruning: even perfect chemistry + this upper rating can't beat worst known?
    const worst = collector.worstFinalScore();
    if (worst > -Infinity) {
      const ratingNorm = upperRating / (99 * 11);
      const optimistic =
        config.chemistryWeight * 1.0 +
        config.strengthWeight  * ratingNorm +
        config.ratingWeight    * ratingNorm;
      if (optimistic < worst * 0.995) return;
    }

    const sc = sortedSlots[depth];
    const slot = formation.slots[sc.slotIndex];

    for (const player of sc.candidates) {
      if (usedIds.has(player.id)) continue;
      if (!player.positions.some(pos => slot.accepts.includes(pos))) continue;

      currentPlayers[depth] = player;
      usedIds.add(player.id);
      backtrack(depth + 1, ratingAccum + player.rating);
      currentPlayers[depth] = null;
      usedIds.delete(player.id);

      if (iters > MAX_ITERS) return;
    }
  }

  backtrack(0, 0);
}

// ----------------------------------------------------------
// Public API
// ----------------------------------------------------------

export interface OptimizerResult {
  rankedLineups: RankedLineup[];
  formationsTried: number;
  formationsSkipped: number;
}

export function findBestLineups(
  players: PlayerCard[],
  options: SearchOptions,
): OptimizerResult {
  const collector = new TopNCollector(options.topN + 4, options.mode);
  let tried = 0;
  let skipped = 0;

  for (const formation of options.formations) {
    const candidates = buildCandidates(formation, players, options.candidateLimit);
    if (!candidates) { skipped++; continue; }

    const sorted = sortByConstraint(candidates);
    searchFormation(formation, sorted, options.chemEngine, options.config, options.mode, collector);
    tried++;
  }

  return {
    rankedLineups: collector.results.slice(0, options.topN),
    formationsTried: tried,
    formationsSkipped: skipped,
  };
}
