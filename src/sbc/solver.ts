import { FC26ChemistryEngine } from '../chemistry/fc26.js';
import { buildPoolFrequency, computeConnectivity } from '../optimizer/index.js';
import type {
  Formation,
  Lineup,
  PlayerCard,
  PositionCode,
} from '../types/index.js';
import { calculateSbcTeamRating } from './rating.js';
import type {
  CardProgram,
  CardQuality,
  CardRarity,
  SbcCardEvaluation,
  SbcChallenge,
  SbcConstraintStatus,
  SbcEntityField,
  SbcField,
  SbcSolution,
  SbcSolveOptions,
  SbcSolveResult,
} from './types.js';

const ALL_POSITIONS: PositionCode[] = [
  'GK',
  'RB', 'LB', 'CB', 'RWB', 'LWB',
  'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST',
];

const SBC_FORMATION: Formation = {
  name: 'SBC',
  slots: Array.from({ length: 11 }, (_, index) => ({
    id: `SBC${index + 1}`,
    label: `SBC${index + 1}`,
    accepts: ALL_POSITIONS,
  })),
  adjacency: {},
};

const chemEngine = new FC26ChemistryEngine();

const VALUE_ALIASES: Record<string, string> = {
  turkey: 'turkey',
  turkiye: 'turkey',
  'türkiye': 'turkey',
  romania: 'romania',
  italy: 'italy',
  'northern ireland': 'northernireland',
  ukraine: 'ukraine',
  sweden: 'sweden',
  ireland: 'ireland',
  'republic of ireland': 'ireland',
  czechia: 'czechia',
  'czech republic': 'czechia',
};

interface Candidate extends SbcCardEvaluation {
  normalizedNation: string;
  normalizedLeague: string;
  normalizedClub: string;
  searchPriority: number;
}

interface SearchContext {
  pool: Candidate[];
  challenge: SbcChallenge;
  suffixMatches: number[][];
  prefixCost: number[];
}

interface SearchState {
  selected: Candidate[];
  countMatches: number[];
  fieldCounts: {
    nation: Map<string, number>;
    league: Map<string, number>;
    club: Map<string, number>;
  };
  keepValue: number;
  ratings: number[];
}

function normalizeCompareValue(raw: string): string {
  const compact = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return VALUE_ALIASES[compact] ?? compact.replace(/\s+/g, '');
}

function getCardQuality(player: PlayerCard): CardQuality {
  if (player.rating >= 75) return 'gold';
  if (player.rating >= 65) return 'silver';
  return 'bronze';
}

function getCardRarity(player: PlayerCard): CardRarity {
  if (player.cardType === 'non_rare') return 'non_rare';
  if ([
    'rare',
    'icon',
    'hero',
    'totw',
    'toty',
    'tots',
    'potm',
    'fut_birthday',
    'special',
  ].includes(player.cardType)) return 'rare';
  return 'unknown';
}

function getCardProgram(player: PlayerCard): CardProgram {
  switch (player.cardType) {
    case 'icon':
    case 'hero':
    case 'totw':
    case 'toty':
    case 'tots':
    case 'potm':
    case 'fut_birthday':
    case 'special':
      return player.cardType;
    default:
      return 'base';
  }
}

function getFieldValue(candidate: Candidate | SbcCardEvaluation, field: SbcField): string {
  switch (field) {
    case 'nation':
      return 'normalizedNation' in candidate ? candidate.normalizedNation : normalizeCompareValue(candidate.player.nation);
    case 'league':
      return 'normalizedLeague' in candidate ? candidate.normalizedLeague : normalizeCompareValue(candidate.player.league);
    case 'club':
      return 'normalizedClub' in candidate ? candidate.normalizedClub : normalizeCompareValue(candidate.player.club);
    case 'quality':
      return candidate.quality;
    case 'rarity':
      return candidate.rarity;
    case 'program':
      return candidate.program;
  }
}

function getEntityFieldValue(candidate: Candidate, field: SbcEntityField): string {
  return getFieldValue(candidate, field);
}

function buildLineup(players: Candidate[]): Lineup {
  return {
    formation: SBC_FORMATION,
    assignments: SBC_FORMATION.slots.map((slot, index) => ({
      slot,
      player: players[index].player,
    })),
  };
}

function countByField(players: Candidate[], field: SbcEntityField): Map<string, number> {
  const counts = new Map<string, number>();
  for (const player of players) {
    const value = getEntityFieldValue(player, field);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function countConstraintMatches(players: Candidate[], field: SbcField, values: string[]): number {
  const allowed = new Set(values.map(value => normalizeCompareValue(value)));
  let count = 0;
  for (const player of players) {
    if (allowed.has(getFieldValue(player, field))) count++;
  }
  return count;
}

function highestBucketCount(counts: Map<string, number>): number {
  let best = 0;
  for (const count of counts.values()) {
    if (count > best) best = count;
  }
  return best;
}

function buildConstraintStatuses(challenge: SbcChallenge, players: Candidate[]): SbcConstraintStatus[] {
  const statuses: SbcConstraintStatus[] = [];
  const nationCounts = countByField(players, 'nation');
  const leagueCounts = countByField(players, 'league');
  const clubCounts = countByField(players, 'club');
  const countsByField = {
    nation: nationCounts,
    league: leagueCounts,
    club: clubCounts,
  };

  for (const constraint of challenge.countConstraints) {
    const actual = countConstraintMatches(players, constraint.field, constraint.values);
    const expected = constraint.min !== undefined ? `>= ${constraint.min}` : `<= ${constraint.max}`;
    statuses.push({
      label: constraint.label,
      ok: constraint.min !== undefined ? actual >= constraint.min : actual <= (constraint.max ?? 0),
      actual: String(actual),
      expected,
    });
  }

  for (const constraint of challenge.sameBucketConstraints) {
    const actual = highestBucketCount(countsByField[constraint.field]);
    const expected = constraint.min !== undefined ? `>= ${constraint.min}` : `<= ${constraint.max}`;
    statuses.push({
      label: constraint.label,
      ok: constraint.min !== undefined ? actual >= constraint.min : actual <= (constraint.max ?? 0),
      actual: String(actual),
      expected,
    });
  }

  for (const constraint of challenge.distinctConstraints) {
    const actual = countsByField[constraint.field].size;
    const expected = constraint.min !== undefined ? `>= ${constraint.min}` : `<= ${constraint.max}`;
    statuses.push({
      label: constraint.label,
      ok: constraint.min !== undefined ? actual >= constraint.min : actual <= (constraint.max ?? 0),
      actual: String(actual),
      expected,
    });
  }

  if (challenge.qualityFloor) {
    const order: CardQuality[] = ['bronze', 'silver', 'gold'];
    const actualQuality = players.reduce<CardQuality>((lowest, player) => {
      return order.indexOf(player.quality) < order.indexOf(lowest) ? player.quality : lowest;
    }, 'gold');
    statuses.push({
      label: `Player Quality: Min ${challenge.qualityFloor[0].toUpperCase()}${challenge.qualityFloor.slice(1)}`,
      ok: order.indexOf(actualQuality) >= order.indexOf(challenge.qualityFloor),
      actual: actualQuality,
      expected: `>= ${challenge.qualityFloor}`,
    });
  }

  const ratings = players.map(player => player.player.rating);
  const chemistry = chemEngine.calculateSquadChemistry(buildLineup(players)).total;
  const teamRating = calculateSbcTeamRating(ratings);

  if (challenge.minTeamRating !== undefined) {
    statuses.push({
      label: `Team Rating: Min ${challenge.minTeamRating}`,
      ok: teamRating >= challenge.minTeamRating,
      actual: String(teamRating),
      expected: `>= ${challenge.minTeamRating}`,
    });
  }

  if (challenge.minChemistry !== undefined) {
    statuses.push({
      label: `Total Chemistry: Min ${challenge.minChemistry}`,
      ok: chemistry >= challenge.minChemistry,
      actual: String(chemistry),
      expected: `>= ${challenge.minChemistry}`,
    });
  }

  return statuses;
}

function buildExplanation(challenge: SbcChallenge, players: Candidate[], chemistry: number, teamRating: number, keepValue: number): string[] {
  const leagueCounts = [...countByField(players, 'league').values()].sort((a, b) => b - a);
  const clubCounts = [...countByField(players, 'club').values()].sort((a, b) => b - a);
  const nationCounts = [...countByField(players, 'nation').values()].sort((a, b) => b - a);

  const lines = [
    `${challenge.name ?? 'SBC'} solved with ${players.length} cards`,
    `Team rating ${teamRating}${challenge.minTeamRating !== undefined ? ` / need ${challenge.minTeamRating}` : ''}`,
    `Chemistry ${chemistry}${challenge.minChemistry !== undefined ? ` / need ${challenge.minChemistry}` : ''}`,
    `Submission keep-value ${keepValue.toFixed(1)} (lower is better)`,
    `Largest nation bucket ${nationCounts[0] ?? 0}, league bucket ${leagueCounts[0] ?? 0}, club bucket ${clubCounts[0] ?? 0}`,
  ];

  const highlyRelevant = players.filter(player => player.matchingConstraintLabels.length > 0);
  if (highlyRelevant.length > 0) {
    lines.push(`Constraint-specific cards: ${highlyRelevant.map(player => player.player.name).join(', ')}`);
  }

  return lines;
}

function scoreProgram(program: CardProgram): number {
  switch (program) {
    case 'icon':
      return 32;
    case 'hero':
      return 24;
    case 'toty':
    case 'tots':
      return 22;
    case 'potm':
    case 'fut_birthday':
      return 18;
    case 'totw':
      return 14;
    case 'special':
      return 10;
    default:
      return 0;
  }
}

function scorePositions(player: PlayerCard): number {
  let bonus = 0;
  if (player.positions.includes('ST')) bonus += 2.0;
  if (player.positions.includes('CAM')) bonus += 1.5;
  if (player.positions.includes('CM')) bonus += 1.0;
  if (player.positions.includes('CB')) bonus += 1.0;
  if (player.positions.includes('GK')) bonus += 0.5;
  return bonus;
}

function qualityAllowed(player: PlayerCard, challenge: SbcChallenge): boolean {
  if (!challenge.qualityFloor) return true;
  const order: CardQuality[] = ['bronze', 'silver', 'gold'];
  return order.indexOf(getCardQuality(player)) >= order.indexOf(challenge.qualityFloor);
}

function buildCandidates(players: PlayerCard[], challenge: SbcChallenge): Candidate[] {
  const filteredPlayers = players.filter(player => qualityAllowed(player, challenge));
  const freq = buildPoolFrequency(filteredPlayers);

  return filteredPlayers.map(player => {
    const quality = getCardQuality(player);
    const rarity = getCardRarity(player);
    const program = getCardProgram(player);
    const normalizedNation = normalizeCompareValue(player.nation);
    const normalizedLeague = normalizeCompareValue(player.league);
    const normalizedClub = normalizeCompareValue(player.club);

    const matchingConstraintLabels = challenge.countConstraints
      .filter(constraint => {
        const allowed = new Set(constraint.values.map(value => normalizeCompareValue(value)));
        return allowed.has(getFieldValue({
          player,
          quality,
          rarity,
          program,
        } as SbcCardEvaluation, constraint.field));
      })
      .map(constraint => constraint.label);

    const clubCount = freq.club[player.club] ?? 0;
    const leagueCount = freq.league[player.league] ?? 0;
    const nationCount = freq.nation[player.nation] ?? 0;
    const scarcityBonus =
      (clubCount <= 1 ? 4 : clubCount === 2 ? 2 : 0) +
      (leagueCount <= 1 ? 3 : leagueCount === 2 ? 1.5 : 0) +
      (nationCount <= 1 ? 3 : nationCount === 2 ? 1.5 : 0);

    const keepValue =
      player.rating * 1.8 +
      (quality === 'gold' ? 2.5 : quality === 'silver' ? 1.0 : 0) +
      (rarity === 'rare' ? 4.0 : 0) +
      scoreProgram(program) +
      scorePositions(player) +
      scarcityBonus;

    const connectivity = computeConnectivity(player, freq);
    const searchPriority =
      keepValue -
      matchingConstraintLabels.length * 8 -
      connectivity * 0.15 -
      (challenge.minChemistry ?? 0) * 0.05 -
      (challenge.minTeamRating ?? 0) * (player.rating / 100) * 0.25;

    return {
      player,
      quality,
      rarity,
      program,
      keepValue,
      matchingConstraintLabels,
      normalizedNation,
      normalizedLeague,
      normalizedClub,
      searchPriority,
    };
  });
}

function precomputeSuffixMatches(pool: Candidate[], challenge: SbcChallenge): number[][] {
  return challenge.countConstraints.map(constraint => {
    const suffix = new Array(pool.length + 1).fill(0);
    const allowed = new Set(constraint.values.map(value => normalizeCompareValue(value)));

    for (let index = pool.length - 1; index >= 0; index--) {
      const matches = allowed.has(getFieldValue(pool[index], constraint.field)) ? 1 : 0;
      suffix[index] = suffix[index + 1] + matches;
    }

    return suffix;
  });
}

function precomputePrefixCost(pool: Candidate[]): number[] {
  const prefix = new Array(pool.length + 1).fill(0);
  for (let index = 0; index < pool.length; index++) {
    prefix[index + 1] = prefix[index] + pool[index].keepValue;
  }
  return prefix;
}

function minRemainingCost(context: SearchContext, startIndex: number, slotsNeeded: number): number {
  const endIndex = startIndex + slotsNeeded;
  if (endIndex > context.pool.length) return Infinity;
  return context.prefixCost[endIndex] - context.prefixCost[startIndex];
}

function maxPossibleTeamRating(pool: Candidate[], startIndex: number, selectedRatings: number[], remainingSlots: number): number {
  const bestRemaining: number[] = [];
  for (let index = startIndex; index < pool.length; index++) {
    const rating = pool[index].player.rating;
    if (bestRemaining.length < remainingSlots) {
      bestRemaining.push(rating);
      bestRemaining.sort((a, b) => a - b);
      continue;
    }
    if (rating > bestRemaining[0]) {
      bestRemaining[0] = rating;
      bestRemaining.sort((a, b) => a - b);
    }
  }

  if (bestRemaining.length < remainingSlots) return 0;
  return calculateSbcTeamRating([...selectedRatings, ...bestRemaining]);
}

function canStillSatisfySameBucketMin(pool: Candidate[], startIndex: number, selectedCounts: Map<string, number>, field: SbcEntityField, min: number): boolean {
  const remainingCounts = new Map<string, number>();
  for (let index = startIndex; index < pool.length; index++) {
    const value = getEntityFieldValue(pool[index], field);
    if (!value) continue;
    remainingCounts.set(value, (remainingCounts.get(value) ?? 0) + 1);
  }

  const seen = new Set<string>([
    ...selectedCounts.keys(),
    ...remainingCounts.keys(),
  ]);

  for (const value of seen) {
    const current = selectedCounts.get(value) ?? 0;
    const available = remainingCounts.get(value) ?? 0;
    if (current + available >= min) return true;
  }

  return false;
}

function canStillSatisfyDistinctMin(pool: Candidate[], startIndex: number, selectedCounts: Map<string, number>, field: SbcEntityField, min: number, remainingSlots: number): boolean {
  const unseen = new Set<string>();
  for (let index = startIndex; index < pool.length; index++) {
    const value = getEntityFieldValue(pool[index], field);
    if (value && !selectedCounts.has(value)) unseen.add(value);
  }
  return selectedCounts.size + Math.min(remainingSlots, unseen.size) >= min;
}

function violatesImmediateConstraints(context: SearchContext, state: SearchState, candidate: Candidate): boolean {
  for (let index = 0; index < context.challenge.countConstraints.length; index++) {
    const constraint = context.challenge.countConstraints[index];
    if (constraint.max === undefined) continue;

    const allowed = new Set(constraint.values.map(value => normalizeCompareValue(value)));
    const matches = allowed.has(getFieldValue(candidate, constraint.field)) ? 1 : 0;
    if (state.countMatches[index] + matches > constraint.max) return true;
  }

  for (const constraint of context.challenge.sameBucketConstraints) {
    if (constraint.max === undefined) continue;
    const counts = state.fieldCounts[constraint.field];
    const value = getEntityFieldValue(candidate, constraint.field);
    const next = (counts.get(value) ?? 0) + 1;
    if (next > constraint.max) return true;
  }

  for (const constraint of context.challenge.distinctConstraints) {
    if (constraint.max === undefined) continue;
    const counts = state.fieldCounts[constraint.field];
    const value = getEntityFieldValue(candidate, constraint.field);
    const nextDistinct = counts.has(value) ? counts.size : counts.size + 1;
    if (nextDistinct > constraint.max) return true;
  }

  return false;
}

function tryBuildSolution(challenge: SbcChallenge, selected: Candidate[]): SbcSolution | null {
  if (selected.length !== challenge.squadSize) return null;

  const chemistry = chemEngine.calculateSquadChemistry(buildLineup(selected)).total;
  const teamRating = calculateSbcTeamRating(selected.map(player => player.player.rating));
  const keepValue = Math.round(selected.reduce((acc, player) => acc + player.keepValue, 0) * 10) / 10;

  if (challenge.minChemistry !== undefined && chemistry < challenge.minChemistry) return null;
  if (challenge.minTeamRating !== undefined && teamRating < challenge.minTeamRating) return null;

  const statuses = buildConstraintStatuses(challenge, selected);
  if (statuses.some(status => !status.ok)) return null;

  const sortedPlayers = [...selected].sort((a, b) => a.keepValue - b.keepValue || a.player.rating - b.player.rating);
  return {
    players: sortedPlayers,
    chemistry,
    teamRating,
    keepValue,
    statuses,
    explanation: buildExplanation(challenge, sortedPlayers, chemistry, teamRating, keepValue),
  };
}

function compareSolutions(a: SbcSolution, b: SbcSolution): number {
  if (a.keepValue !== b.keepValue) return a.keepValue - b.keepValue;
  if (a.teamRating !== b.teamRating) return a.teamRating - b.teamRating;
  if (a.chemistry !== b.chemistry) return a.chemistry - b.chemistry;
  return 0;
}

function searchBestSolution(context: SearchContext): { solution: SbcSolution | null; iterations: number } {
  const state: SearchState = {
    selected: [],
    countMatches: new Array(context.challenge.countConstraints.length).fill(0),
    fieldCounts: {
      nation: new Map(),
      league: new Map(),
      club: new Map(),
    },
    keepValue: 0,
    ratings: [],
  };

  let best: SbcSolution | null = null;
  let iterations = 0;

  function dfs(startIndex: number): void {
    iterations++;

    const remainingSlots = context.challenge.squadSize - state.selected.length;
    const remainingPlayers = context.pool.length - startIndex;
    if (remainingSlots === 0) {
      const solution = tryBuildSolution(context.challenge, state.selected);
      if (solution && (!best || compareSolutions(solution, best) < 0)) {
        best = solution;
      }
      return;
    }

    if (remainingPlayers < remainingSlots) return;

    if (best) {
      const optimisticCost = state.keepValue + minRemainingCost(context, startIndex, remainingSlots);
      if (optimisticCost >= best.keepValue) return;
    }

    for (let index = 0; index < context.challenge.countConstraints.length; index++) {
      const constraint = context.challenge.countConstraints[index];
      if (constraint.min === undefined) continue;
      if (state.countMatches[index] + context.suffixMatches[index][startIndex] < constraint.min) {
        return;
      }
    }

    for (const constraint of context.challenge.sameBucketConstraints) {
      if (constraint.min === undefined) continue;
      if (!canStillSatisfySameBucketMin(context.pool, startIndex, state.fieldCounts[constraint.field], constraint.field, constraint.min)) {
        return;
      }
    }

    for (const constraint of context.challenge.distinctConstraints) {
      if (constraint.min === undefined) continue;
      if (!canStillSatisfyDistinctMin(context.pool, startIndex, state.fieldCounts[constraint.field], constraint.field, constraint.min, remainingSlots)) {
        return;
      }
    }

    if (
      context.challenge.minTeamRating !== undefined &&
      maxPossibleTeamRating(context.pool, startIndex, state.ratings, remainingSlots) < context.challenge.minTeamRating
    ) {
      return;
    }

    const candidate = context.pool[startIndex];
    if (!violatesImmediateConstraints(context, state, candidate)) {
      state.selected.push(candidate);
      state.keepValue += candidate.keepValue;
      state.ratings.push(candidate.player.rating);

      for (let index = 0; index < context.challenge.countConstraints.length; index++) {
        const constraint = context.challenge.countConstraints[index];
        const allowed = new Set(constraint.values.map(value => normalizeCompareValue(value)));
        if (allowed.has(getFieldValue(candidate, constraint.field))) {
          state.countMatches[index]++;
        }
      }

      for (const field of ['nation', 'league', 'club'] as const) {
        const value = getEntityFieldValue(candidate, field);
        const counts = state.fieldCounts[field];
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }

      dfs(startIndex + 1);

      for (const field of ['nation', 'league', 'club'] as const) {
        const value = getEntityFieldValue(candidate, field);
        const counts = state.fieldCounts[field];
        const next = (counts.get(value) ?? 0) - 1;
        if (next <= 0) counts.delete(value);
        else counts.set(value, next);
      }

      for (let index = 0; index < context.challenge.countConstraints.length; index++) {
        const constraint = context.challenge.countConstraints[index];
        const allowed = new Set(constraint.values.map(value => normalizeCompareValue(value)));
        if (allowed.has(getFieldValue(candidate, constraint.field))) {
          state.countMatches[index]--;
        }
      }

      state.ratings.pop();
      state.keepValue -= candidate.keepValue;
      state.selected.pop();
    }

    dfs(startIndex + 1);
  }

  dfs(0);
  return { solution: best, iterations };
}

export function solveSbc(players: PlayerCard[], challenge: SbcChallenge, options: SbcSolveOptions = {}): SbcSolveResult {
  const warnings: string[] = [];
  const candidates = buildCandidates(players, challenge);
  const heuristicOrder = [...candidates].sort((a, b) => a.searchPriority - b.searchPriority);
  const requestedPools = options.candidatePoolSizes ?? [40, 60, 80, 100, 140];

  let best: SbcSolution | null = null;
  let totalIterations = 0;
  let finalPoolSize = 0;

  for (const requestedSize of requestedPools) {
    const poolSize = Math.min(requestedSize, heuristicOrder.length);
    if (poolSize <= finalPoolSize) continue;
    finalPoolSize = poolSize;

    const shortlist = heuristicOrder.slice(0, poolSize);
    const pool = [...shortlist].sort((a, b) => a.keepValue - b.keepValue || a.player.rating - b.player.rating);
    const context: SearchContext = {
      pool,
      challenge,
      suffixMatches: precomputeSuffixMatches(pool, challenge),
      prefixCost: precomputePrefixCost(pool),
    };

    const { solution, iterations } = searchBestSolution(context);
    totalIterations += iterations;
    if (solution && (!best || compareSolutions(solution, best) < 0)) {
      best = solution;
    }

    if (poolSize === heuristicOrder.length) break;
  }

  if (heuristicOrder.length > finalPoolSize) {
    warnings.push(
      `SBC search used a heuristic candidate pool (${finalPoolSize}/${heuristicOrder.length} eligible cards). ` +
      `If no solution is found, rerun later with a larger pool size in code or relax the requirements.`,
    );
  }

  return {
    challenge,
    solution: best,
    searchedPlayers: candidates.length,
    candidatePoolSize: finalPoolSize,
    iterations: totalIterations,
    warnings,
  };
}
