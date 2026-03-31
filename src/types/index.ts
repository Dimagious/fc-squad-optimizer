// ============================================================
// types/index.ts — Core domain model for FC Optimizer
// ============================================================

// ----------------------------------------------------------
// Player
// ----------------------------------------------------------

export type PositionCode =
  | 'GK'
  | 'RB' | 'LB' | 'CB' | 'RWB' | 'LWB'
  | 'CDM' | 'CM' | 'CAM'
  | 'RM' | 'LM' | 'RW' | 'LW'
  | 'CF' | 'ST';

export type CardType =
  | 'gold' | 'silver' | 'bronze'
  | 'icon' | 'hero'
  | 'totw' | 'toty' | 'tots' | 'potm' | 'fut_birthday'
  | 'special' | 'rare' | 'non_rare' | 'unknown';

export interface PlayerCard {
  /** Unique identifier within this session (row index or derived) */
  id: string;
  name: string;
  /** Overall rating 1–99 */
  rating: number;
  nation: string;
  league: string;
  club: string;
  /** All positions this card can play, e.g. ['ST', 'CF'] */
  positions: PositionCode[];
  cardType: CardType;
  /** True for Icon cards — provide chemistry links across nations/leagues */
  isIcon: boolean;
  /** True for Hero cards — provide chemistry within their league */
  isHero: boolean;
  /** Raw source row for debugging */
  _raw?: Record<string, string>;
}

// ----------------------------------------------------------
// Formations
// ----------------------------------------------------------

export interface FormationSlot {
  /** Slot identifier, e.g. "LB", "CB1", "ST" */
  id: string;
  /** Acceptable position codes for this slot */
  accepts: PositionCode[];
  /** Display label */
  label: string;
}

export interface Formation {
  name: string; // e.g. "4-3-3"
  slots: FormationSlot[]; // always 11 slots
  /**
   * Formation adjacency map: slotId → IDs of directly adjacent slots.
   * Chemistry links are only counted between adjacent slots.
   * Must be symmetric: if A lists B, then B must list A.
   */
  adjacency: Record<string, string[]>;
}

// ----------------------------------------------------------
// Chemistry
// ----------------------------------------------------------

export interface PlayerChemistryBreakdown {
  playerId: string;
  playerName: string;
  slotId: string;
  /** Individual chemistry 0–3 */
  individualChem: number;
  nationLinks: number;
  leagueLinks: number;
  clubLinks: number;
  isIcon: boolean;
  isHero: boolean;
  notes: string[];
}

export interface ChemistryBreakdown {
  /** Total squad chemistry 0–33 */
  total: number;
  players: PlayerChemistryBreakdown[];
}

/** Chemistry engine interface — swap implementations per FC season */
export interface ChemistryEngine {
  calculateSquadChemistry(lineup: Lineup): ChemistryBreakdown;
}

// ----------------------------------------------------------
// Lineup
// ----------------------------------------------------------

export interface LineupSlotAssignment {
  slot: FormationSlot;
  player: PlayerCard;
}

export interface Lineup {
  formation: Formation;
  assignments: LineupSlotAssignment[];
}

// ----------------------------------------------------------
// Scoring
// ----------------------------------------------------------

export type OptimizationMode = 'max-chem' | 'balanced' | 'max-rating' | 'meta';

export interface PositionWeights {
  GK: number;
  CB: number;
  LB: number;
  RB: number;
  LWB: number;
  RWB: number;
  CDM: number;
  CM: number;
  CAM: number;
  LM: number;
  RM: number;
  LW: number;
  RW: number;
  CF: number;
  ST: number;
}

export interface ScoringConfig {
  /** Weight for chemistry in final score (0–1 range suggested) */
  chemistryWeight: number;
  /** Weight for strength score */
  strengthWeight: number;
  /** Weight for total rating as tie-breaker */
  ratingWeight: number;
  /** Bonus added to strength for Icon cards */
  iconBonus: number;
  /** Bonus added to strength for Hero cards */
  heroBonus: number;
  /** Bonus for special/promo cards */
  specialCardBonus: number;
  /** Per-position strength multipliers */
  positionWeights: PositionWeights;
}

export interface LineupScore {
  totalChemistry: number;
  strengthScore: number;
  totalRating: number;
  averageRating: number;
  /** Final combined score used for ranking */
  finalScore: number;
}

// ----------------------------------------------------------
// Optimization
// ----------------------------------------------------------

export interface SwapSuggestion {
  slotId: string;
  currentPlayer: PlayerCard;
  alternativePlayer: PlayerCard;
  chemDelta: number;
  ratingDelta: number;
  strengthDelta: number;
  description: string;
}

export interface AlternativeLineup {
  lineup: Lineup;
  score: LineupScore;
  chemistry: ChemistryBreakdown;
  rank: number;
  diffFromBest: string;
}

export interface BenchSuggestion {
  player: PlayerCard;
  role: 'GK' | 'DEF' | 'MID' | 'ATT';
  reason: string;
}

export interface OptimizationResult {
  mode: OptimizationMode;
  bestLineup: Lineup;
  bestScore: LineupScore;
  bestChemistry: ChemistryBreakdown;
  alternatives: AlternativeLineup[];
  swapSuggestions: SwapSuggestion[];
  bench: BenchSuggestion[];
  explanation: string[];
  durationMs: number;
}

// ----------------------------------------------------------
// Config overrides (from JSON file)
// ----------------------------------------------------------

export interface ConfigFile {
  mode?: OptimizationMode;
  scoringOverrides?: Partial<ScoringConfig>;
  candidateLimit?: number;
  formations?: string[];
}
