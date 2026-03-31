import type { PlayerCard } from '../types/index.js';

export type SbcField = 'nation' | 'league' | 'club' | 'quality' | 'rarity' | 'program';
export type SbcEntityField = 'nation' | 'league' | 'club';
export type CardQuality = 'bronze' | 'silver' | 'gold';
export type CardRarity = 'rare' | 'non_rare' | 'unknown';
export type CardProgram =
  | 'base'
  | 'icon'
  | 'hero'
  | 'totw'
  | 'toty'
  | 'tots'
  | 'potm'
  | 'fut_birthday'
  | 'special'
  | 'unknown';

export interface SbcCountConstraint {
  field: SbcField;
  values: string[];
  min?: number;
  max?: number;
  label: string;
}

export interface SbcSameBucketConstraint {
  field: SbcEntityField;
  min?: number;
  max?: number;
  label: string;
}

export interface SbcDistinctConstraint {
  field: SbcEntityField;
  min?: number;
  max?: number;
  label: string;
}

export interface SbcChallenge {
  name?: string;
  squadSize: number;
  minTeamRating?: number;
  minChemistry?: number;
  qualityFloor?: CardQuality;
  countConstraints: SbcCountConstraint[];
  sameBucketConstraints: SbcSameBucketConstraint[];
  distinctConstraints: SbcDistinctConstraint[];
  sourceLines: string[];
}

export interface SbcCardEvaluation {
  player: PlayerCard;
  quality: CardQuality;
  rarity: CardRarity;
  program: CardProgram;
  keepValue: number;
  matchingConstraintLabels: string[];
}

export interface SbcConstraintStatus {
  label: string;
  ok: boolean;
  actual: string;
  expected: string;
}

export interface SbcSolution {
  players: SbcCardEvaluation[];
  chemistry: number;
  teamRating: number;
  keepValue: number;
  statuses: SbcConstraintStatus[];
  explanation: string[];
}

export interface SbcSolveOptions {
  maxSolutions?: number;
  candidatePoolSizes?: number[];
}

export interface SbcSolveResult {
  challenge: SbcChallenge;
  solution: SbcSolution | null;
  searchedPlayers: number;
  candidatePoolSize: number;
  iterations: number;
  warnings: string[];
}
