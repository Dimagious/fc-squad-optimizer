// ============================================================
// scorer/index.ts — Configurable scoring system
//
// Each optimization mode uses a different ScoringConfig.
// The final score = weighted combination of:
//   - chemistry (0–33 normalized to 0–1)
//   - strength score (rating + bonuses, normalized)
//   - total rating (tie-breaker)
// ============================================================

import type {
  ScoringConfig,
  OptimizationMode,
  LineupScore,
  Lineup,
  PlayerCard,
  ChemistryBreakdown,
  PositionCode,
} from '../types/index.js';

// ----------------------------------------------------------
// Default position weights — higher means more important
// to have a strong card in that role
// ----------------------------------------------------------

const DEFAULT_POSITION_WEIGHTS: ScoringConfig['positionWeights'] = {
  GK:  1.0,
  CB:  0.95,
  LB:  0.85,
  RB:  0.85,
  LWB: 0.80,
  RWB: 0.80,
  CDM: 0.90,
  CM:  0.88,
  CAM: 0.90,
  LM:  0.82,
  RM:  0.82,
  LW:  0.88,
  RW:  0.88,
  CF:  0.92,
  ST:  0.95,
};

// ----------------------------------------------------------
// Scoring presets per optimization mode
// ----------------------------------------------------------

export const SCORING_PRESETS: Record<OptimizationMode, ScoringConfig> = {
  /**
   * max-chem: chemistry is everything.
   * Strength is secondary, raw rating is barely considered.
   */
  'max-chem': {
    chemistryWeight:  0.75,
    strengthWeight:   0.20,
    ratingWeight:     0.05,
    iconBonus:        5.0,
    heroBonus:        4.0,
    specialCardBonus: 1.0,
    positionWeights:  DEFAULT_POSITION_WEIGHTS,
  },

  /**
   * balanced: strong chemistry with good squad quality.
   * Classic approach for competitive squads.
   */
  'balanced': {
    chemistryWeight:  0.50,
    strengthWeight:   0.35,
    ratingWeight:     0.15,
    iconBonus:        3.0,
    heroBonus:        2.5,
    specialCardBonus: 1.5,
    positionWeights:  DEFAULT_POSITION_WEIGHTS,
  },

  /**
   * max-rating: get the highest possible average rating.
   * Chemistry is still tracked and reported, but not primary.
   */
  'max-rating': {
    chemistryWeight:  0.15,
    strengthWeight:   0.20,
    ratingWeight:     0.65,
    iconBonus:        2.0,
    heroBonus:        1.5,
    specialCardBonus: 2.0,
    positionWeights:  DEFAULT_POSITION_WEIGHTS,
  },

  /**
   * meta: role quality + practical usefulness + chemistry.
   * Applies position-specific weights more aggressively
   * to reward well-placed high-impact cards.
   */
  'meta': {
    chemistryWeight:  0.40,
    strengthWeight:   0.45,
    ratingWeight:     0.15,
    iconBonus:        4.0,
    heroBonus:        3.5,
    specialCardBonus: 2.5,
    positionWeights: {
      ...DEFAULT_POSITION_WEIGHTS,
      ST:  1.10, // attackers weighted higher in meta
      CAM: 1.05,
      CB:  1.00,
      GK:  0.90, // GK meta less important than attack
    },
  },
};

// ----------------------------------------------------------
// Strength score calculation
// ----------------------------------------------------------

/**
 * Returns the primary position of a player in this slot context
 */
function getSlotPosition(slotAccepts: string[]): PositionCode {
  // Return first accepted position as representative
  return slotAccepts[0] as PositionCode;
}

/**
 * Calculate strength score for a single player in their slot.
 * Formula: (rating + bonuses) × position_weight
 */
export function calculatePlayerStrength(
  player: PlayerCard,
  slotAccepts: string[],
  config: ScoringConfig,
): number {
  let base = player.rating;

  if (player.isIcon) base += config.iconBonus;
  else if (player.isHero) base += config.heroBonus;

  const isSpecial = ['totw', 'toty', 'tots', 'potm', 'fut_birthday', 'special'].includes(player.cardType);
  if (isSpecial) base += config.specialCardBonus;

  const pos = getSlotPosition(slotAccepts);
  const weight = config.positionWeights[pos] ?? 1.0;

  return base * weight;
}

/**
 * Compute all scoring metrics for a lineup.
 */
export function scoreLineup(
  lineup: Lineup,
  chemistry: ChemistryBreakdown,
  config: ScoringConfig,
): LineupScore {
  const totalChemistry = chemistry.total;

  let totalRating = 0;
  let strengthScore = 0;

  for (const assignment of lineup.assignments) {
    totalRating += assignment.player.rating;
    strengthScore += calculatePlayerStrength(
      assignment.player,
      assignment.slot.accepts as string[],
      config,
    );
  }

  const averageRating = totalRating / 11;

  // Normalize chemistry to 0–1 range (max 33)
  const chemNorm = totalChemistry / 33;
  // Normalize strength (roughly rating range 60–99 * position weight ~1.0)
  const strengthNorm = strengthScore / (99 * 11 * 1.1);
  // Normalize rating
  const ratingNorm = totalRating / (99 * 11);

  const finalScore =
    config.chemistryWeight  * chemNorm +
    config.strengthWeight   * strengthNorm +
    config.ratingWeight     * ratingNorm;

  return {
    totalChemistry,
    strengthScore: Math.round(strengthScore * 10) / 10,
    totalRating,
    averageRating: Math.round(averageRating * 10) / 10,
    finalScore: Math.round(finalScore * 10000) / 10000,
  };
}

/**
 * Compare two lineups: returns positive if a > b, negative if a < b.
 * Used by the optimizer for tie-breaking.
 */
export function compareScores(a: LineupScore, b: LineupScore, mode: OptimizationMode): number {
  if (mode === 'max-rating') {
    // Primary: total rating
    if (a.totalRating !== b.totalRating) return a.totalRating - b.totalRating;
    if (a.totalChemistry !== b.totalChemistry) return a.totalChemistry - b.totalChemistry;
    return a.strengthScore - b.strengthScore;
  }

  if (mode === 'max-chem') {
    // Primary: chemistry
    if (a.totalChemistry !== b.totalChemistry) return a.totalChemistry - b.totalChemistry;
    if (a.strengthScore !== b.strengthScore) return a.strengthScore - b.strengthScore;
    return a.totalRating - b.totalRating;
  }

  // balanced / meta: use final combined score
  return a.finalScore - b.finalScore;
}

/**
 * Apply config file overrides to a base scoring config.
 */
export function applyConfigOverrides(
  base: ScoringConfig,
  overrides: Partial<ScoringConfig>,
): ScoringConfig {
  return {
    ...base,
    ...overrides,
    positionWeights: {
      ...base.positionWeights,
      ...overrides.positionWeights,
    },
  };
}
