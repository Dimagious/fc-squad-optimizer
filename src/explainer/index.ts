// ============================================================
// explainer/index.ts — Human-readable explanations and swap analysis
// ============================================================

import type {
  Lineup,
  LineupScore,
  ChemistryBreakdown,
  PlayerCard,
  SwapSuggestion,
  BenchSuggestion,
  OptimizationMode,
  AlternativeLineup,
  ScoringConfig,
} from '../types/index.js';
import type { ChemistryEngine } from '../types/index.js';
import type { RankedLineup } from '../optimizer/index.js';
import { scoreLineup } from '../scorer/index.js';

// ----------------------------------------------------------
// Main explanation for the winning lineup
// ----------------------------------------------------------

export function explainLineup(
  lineup: Lineup,
  score: LineupScore,
  chemistry: ChemistryBreakdown,
  mode: OptimizationMode,
  alternatives: AlternativeLineup[],
): string[] {
  const lines: string[] = [];

  lines.push(`Formation: ${lineup.formation.name} | Mode: ${mode}`);
  lines.push(`Total chemistry: ${score.totalChemistry}/33 | Average rating: ${score.averageRating} | Total rating: ${score.totalRating}`);

  // Chemistry status
  if (score.totalChemistry === 33) {
    lines.push('✓ Perfect chemistry (33/33) — all players are fully linked');
  } else if (score.totalChemistry >= 27) {
    lines.push(`Good chemistry (${score.totalChemistry}/33) — most players are well-connected`);
  } else {
    lines.push(`Chemistry is below ideal (${score.totalChemistry}/33) — consider hybrid adjustments`);
  }

  // Icon/Hero presence
  const icons = lineup.assignments.filter(a => a.player.isIcon);
  const heroes = lineup.assignments.filter(a => a.player.isHero);
  if (icons.length > 0) {
    lines.push(`Icons: ${icons.map(a => a.player.name).join(', ')} — bridging chemistry links across nations/leagues`);
  }
  if (heroes.length > 0) {
    lines.push(`Heroes: ${heroes.map(a => a.player.name).join(', ')} — providing league-based chemistry boosts`);
  }

  // Players at 0 chem
  const zeroChem = chemistry.players.filter(p => p.individualChem === 0);
  if (zeroChem.length > 0) {
    lines.push(`⚠ Players at 0 chemistry: ${zeroChem.map(p => p.playerName).join(', ')} — consider swapping or restructuring`);
  }

  // Why this formation won
  if (alternatives.length > 0) {
    const alt = alternatives[0];
    if (alt.score.totalChemistry < score.totalChemistry) {
      lines.push(`This formation beats ${alt.lineup.formation.name} by ${score.totalChemistry - alt.score.totalChemistry} chemistry points`);
    } else if (alt.score.totalRating < score.totalRating) {
      lines.push(`This formation beats ${alt.lineup.formation.name} by ${score.totalRating - alt.score.totalRating} total rating`);
    }
  }

  // Mode-specific notes
  if (mode === 'max-chem' && score.totalChemistry < 33) {
    lines.push('Tip: In max-chem mode, try adding more players from the same club or nation');
  }
  if (mode === 'max-rating') {
    lines.push(`Note: In max-rating mode, chemistry (${score.totalChemistry}/33) is secondary to squad quality`);
  }

  return lines;
}

// ----------------------------------------------------------
// Swap analysis
// ----------------------------------------------------------

/**
 * For each slot in the best lineup, try the next best eligible alternative
 * and calculate the impact of swapping them in.
 */
export function generateSwapSuggestions(
  bestLineup: Lineup,
  bestScore: LineupScore,
  bestChem: ChemistryBreakdown,
  allPlayers: PlayerCard[],
  chemEngine: ChemistryEngine,
  config: ScoringConfig,
): SwapSuggestion[] {
  const suggestions: SwapSuggestion[] = [];
  const currentPlayerIds = new Set(bestLineup.assignments.map(a => a.player.id));

  for (const assignment of bestLineup.assignments) {
    const slot = assignment.slot;
    const currentPlayer = assignment.player;

    // Find best alternative for this slot (not already in lineup)
    const alternatives = allPlayers
      .filter(p =>
        !currentPlayerIds.has(p.id) &&
        p.positions.some(pos => slot.accepts.includes(pos))
      )
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    if (alternatives.length === 0) continue;

    // Try top 3 alternatives
    for (const alt of alternatives.slice(0, 3)) {
      // Build a test lineup with the swap
      const testAssignments = bestLineup.assignments.map(a =>
        a.slot.id === slot.id
          ? { slot: a.slot, player: alt }
          : a
      );
      const testLineup: Lineup = { formation: bestLineup.formation, assignments: testAssignments };
      const testChem = chemEngine.calculateSquadChemistry(testLineup);
      const testScore = scoreLineup(testLineup, testChem, config);

      const chemDelta = testScore.totalChemistry - bestScore.totalChemistry;
      const ratingDelta = testScore.totalRating - bestScore.totalRating;
      const strengthDelta = Math.round((testScore.strengthScore - bestScore.strengthScore) * 10) / 10;

      // Only report meaningful swaps
      if (ratingDelta === 0 && chemDelta === 0) continue;

      let description: string;
      if (chemDelta === 0) {
        description = `Swap ${currentPlayer.name} → ${alt.name}: chemistry neutral, rating ${ratingDelta > 0 ? '+' : ''}${ratingDelta}`;
      } else if (chemDelta > 0) {
        description = `Swap ${currentPlayer.name} → ${alt.name}: +${chemDelta} chemistry, rating ${ratingDelta > 0 ? '+' : ''}${ratingDelta}`;
      } else {
        description = `Swap ${currentPlayer.name} → ${alt.name}: ${chemDelta} chemistry, rating ${ratingDelta > 0 ? '+' : ''}${ratingDelta}`;
      }

      suggestions.push({
        slotId: slot.id,
        currentPlayer,
        alternativePlayer: alt,
        chemDelta,
        ratingDelta,
        strengthDelta,
        description,
      });

      // Only show the single best swap per slot
      break;
    }
  }

  // Sort: chemistry-preserving swaps first, then by rating gain
  return suggestions.sort((a, b) => {
    if (b.chemDelta !== a.chemDelta) return b.chemDelta - a.chemDelta;
    return b.ratingDelta - a.ratingDelta;
  });
}

// ----------------------------------------------------------
// Alternative lineup comparison
// ----------------------------------------------------------

export function buildAlternatives(
  ranked: RankedLineup[],
  bestScore: LineupScore,
): AlternativeLineup[] {
  return ranked.slice(1).map((r, i) => {
    const chemDiff = r.score.totalChemistry - bestScore.totalChemistry;
    const ratingDiff = r.score.totalRating - bestScore.totalRating;

    let diff = '';
    if (chemDiff !== 0) diff += `${chemDiff > 0 ? '+' : ''}${chemDiff} chemistry`;
    if (ratingDiff !== 0) {
      if (diff) diff += ', ';
      diff += `${ratingDiff > 0 ? '+' : ''}${ratingDiff} rating`;
    }
    if (!diff) diff = 'Same chemistry and rating, different players';

    return {
      lineup: r.lineup,
      score: r.score,
      chemistry: r.chemistry,
      rank: i + 2,
      diffFromBest: diff,
    };
  });
}

// ----------------------------------------------------------
// Bench suggestions
// ----------------------------------------------------------

export function suggestBench(
  allPlayers: PlayerCard[],
  startingXI: Lineup,
): BenchSuggestion[] {
  const usedIds = new Set(startingXI.assignments.map(a => a.player.id));
  const bench: BenchSuggestion[] = [];
  const benchIds = new Set<string>();

  function addBest(
    filter: (p: PlayerCard) => boolean,
    role: BenchSuggestion['role'],
    reason: string,
    max = 2,
  ) {
    const candidates = allPlayers
      .filter(p => !usedIds.has(p.id) && !benchIds.has(p.id) && filter(p))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, max);

    for (const p of candidates) {
      bench.push({ player: p, role, reason });
      benchIds.add(p.id);
    }
  }

  // 1 GK
  addBest(p => p.positions.includes('GK'), 'GK', 'Backup goalkeeper', 1);

  // 2 Defenders
  addBest(
    p => p.positions.some(pos => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)),
    'DEF',
    'Defensive cover',
    2,
  );

  // 2 Midfielders
  addBest(
    p => p.positions.some(pos => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)),
    'MID',
    'Midfield control sub',
    2,
  );

  // 2 Attackers
  addBest(
    p => p.positions.some(pos => ['ST', 'CF', 'LW', 'RW'].includes(pos)),
    'ATT',
    'Super-sub attacker',
    2,
  );

  return bench.slice(0, 7);
}
