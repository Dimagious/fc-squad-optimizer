// ============================================================
// chemistry/fc26.ts — EA Sports FC 26 Chemistry Engine
//
// ASSUMPTIONS:
//
// 1. FC 26 uses a SQUAD-WIDE THRESHOLD model, not formation
//    adjacency. Every in-position player contributes to the
//    squad's club/nation/league counters, and all players in
//    the same group benefit equally when a threshold is crossed.
//
// 2. Individual chemistry thresholds (same as FC 25):
//    Club  : ≥2 → +1 | ≥4 → +2 | ≥7 → +3
//    Nation: ≥2 → +1 | ≥5 → +2 | ≥8 → +3
//    League: ≥3 → +1 | ≥5 → +2 | ≥8 → +3
//    individual_chem = min(3, club_bonus + nation_bonus + league_bonus)
//
// 3. Special card contributions:
//    Icons : always 3 individual chem.
//            Contribute 2 increments to their nation counter
//            and 1 increment to EVERY league counter in the squad.
//    Heroes: always 3 individual chem.
//            Contribute 1 increment to their nation counter
//            and 2 increments to their league counter.
//
// 4. Manager bonus: +1 individual chem to all players sharing
//    the manager's nationality OR league (capped at 3).
//    Currently modelled as an optional engine config — pass
//    undefined to omit.
//
// 5. Women's-men's cross-club links (new in FC 26):
//    A women's player and a men's player from the same affiliated
//    club share a club link (e.g. Chelsea FC Women ↔ Chelsea FC).
//    Not yet modelled — add a `affiliatedClub` field to PlayerCard
//    and a TODO is left below when this is needed.
//
// 6. Chemistry style stat boosts reduced by 25% vs FC 25
//    (4/8/12 → 3/6/9). This affects in-game attribute deltas,
//    NOT the 0–3 chem score. We don't model attribute boosts.
//
// 7. Out-of-position players earn 0 chemistry and contribute
//    0 increments to any threshold. The optimizer guarantees
//    positional fit, so we treat all starters as in-position.
//
// SOURCES:
//   EA FC 26 Chemistry Deep Dive — fifauteam.com/fc-26-chemistry/
//   EA FC 26 Chemistry Guide — teamgullit.com/ea-fc-26/chemistry
//   EA Sports FC 26 FUT Deep Dive — ea.com (Sep 2025)
// ============================================================

import type {
  ChemistryEngine,
  ChemistryBreakdown,
  Lineup,
  PlayerCard,
  PlayerChemistryBreakdown,
} from '../types/index.js';

// ----------------------------------------------------------
// Threshold tables — min squad count → chem bonus awarded
// to every eligible player in that group.
// Adjustable here without touching the rest of the engine.
// ----------------------------------------------------------

const CLUB_THRESHOLDS = [
  { min: 7, bonus: 3 },
  { min: 4, bonus: 2 },
  { min: 2, bonus: 1 },
] as const;

const NATION_THRESHOLDS = [
  { min: 8, bonus: 3 },
  { min: 5, bonus: 2 },
  { min: 2, bonus: 1 },
] as const;

const LEAGUE_THRESHOLDS = [
  { min: 8, bonus: 3 },
  { min: 5, bonus: 2 },
  { min: 3, bonus: 1 },
] as const;

// ----------------------------------------------------------
// Manager config (optional)
// ----------------------------------------------------------

export interface ManagerConfig {
  /** Manager's nationality, e.g. 'Spain' */
  nation?: string;
  /** Manager's league, e.g. 'La Liga' */
  league?: string;
}

// ----------------------------------------------------------
// Internal count structure
// ----------------------------------------------------------

interface ThresholdCounts {
  club:   Record<string, number>;
  nation: Record<string, number>;
  league: Record<string, number>;
  /** Number of Icon cards in the XI — each adds +1 to every league counter */
  iconCount: number;
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBonus(
  count: number,
  thresholds: readonly { min: number; bonus: number }[],
): number {
  for (const t of thresholds) {
    if (count >= t.min) return t.bonus;
  }
  return 0;
}

/**
 * Accumulate squad-wide club/nation/league counters from all 11 starters.
 * Icons and Heroes use their special increment rules.
 */
function buildCounts(lineup: Lineup): ThresholdCounts {
  const club:   Record<string, number> = {};
  const nation: Record<string, number> = {};
  const league: Record<string, number> = {};
  let iconCount = 0;

  for (const { player } of lineup.assignments) {
    if (player.isIcon) {
      iconCount++;
      // Icons: 2 nation increments; league handled globally via iconCount
      if (player.nation) nation[player.nation] = (nation[player.nation] ?? 0) + 2;
      continue;
    }

    if (player.isHero) {
      // Heroes: 2 league increments + 1 nation increment for their group
      if (player.nation) nation[player.nation] = (nation[player.nation] ?? 0) + 1;
      if (player.league) league[player.league] = (league[player.league] ?? 0) + 2;
      // TODO FC 26: Heroes do not contribute to club thresholds per EA rules
      continue;
    }

    // Regular player: 1 increment to each of their groups
    if (player.club)   club[player.club]     = (club[player.club]     ?? 0) + 1;
    if (player.league) league[player.league] = (league[player.league] ?? 0) + 1;
    if (player.nation) nation[player.nation] = (nation[player.nation] ?? 0) + 1;
    // TODO FC 26: women's affiliated club cross-link not yet modelled
  }

  return { club, nation, league, iconCount };
}

/**
 * Calculate individual chemistry for one player using the squad counts.
 * Icons and Heroes always return 3.
 */
function calcIndividualChem(
  player: PlayerCard,
  counts: ThresholdCounts,
  manager: ManagerConfig | undefined,
): { chem: number; clubBonus: number; nationBonus: number; leagueBonus: number } {
  if (player.isIcon || player.isHero) {
    return { chem: 3, clubBonus: 0, nationBonus: 0, leagueBonus: 0 };
  }

  const clubBonus   = getBonus(counts.club[player.club]     ?? 0, CLUB_THRESHOLDS);
  const nationBonus = getBonus(counts.nation[player.nation] ?? 0, NATION_THRESHOLDS);
  // Each Icon in the squad adds +1 to every player's effective league count
  const effectiveLeague = (counts.league[player.league] ?? 0) + counts.iconCount;
  const leagueBonus = getBonus(effectiveLeague, LEAGUE_THRESHOLDS);

  let managerBonus = 0;
  if (manager) {
    if (
      (manager.nation && manager.nation === player.nation) ||
      (manager.league && manager.league === player.league)
    ) {
      managerBonus = 1;
    }
  }

  const chem = clamp(clubBonus + nationBonus + leagueBonus + managerBonus, 0, 3);
  return { chem, clubBonus, nationBonus, leagueBonus };
}

// ----------------------------------------------------------
// FC26ChemistryEngine — implements ChemistryEngine interface
// ----------------------------------------------------------

export class FC26ChemistryEngine implements ChemistryEngine {
  constructor(private readonly manager?: ManagerConfig) {}

  calculateSquadChemistry(lineup: Lineup): ChemistryBreakdown {
    const counts = buildCounts(lineup);
    const breakdowns: PlayerChemistryBreakdown[] = [];

    for (const assignment of lineup.assignments) {
      const player  = assignment.player;
      const { chem, clubBonus, nationBonus, leagueBonus } =
        calcIndividualChem(player, counts, this.manager);

      const notes: string[] = [];
      if (player.isIcon)  notes.push('Icon — always 3 chemistry, boosts every league counter');
      if (player.isHero)  notes.push('Hero — always 3 chemistry, boosts league and nation counters');
      if (!player.isIcon && !player.isHero) {
        if (clubBonus   > 0) notes.push(`Club threshold → +${clubBonus}`);
        if (nationBonus > 0) notes.push(`Nation threshold → +${nationBonus}`);
        if (leagueBonus > 0) notes.push(`League threshold → +${leagueBonus}`);
        if (chem === 0)      notes.push('No thresholds reached — isolated player');
      }

      // Re-use existing breakdown fields:
      //   clubLinks   = club bonus points (0–3)
      //   leagueLinks = league bonus points (0–3)
      //   nationLinks = nation bonus points (0–3)
      breakdowns.push({
        playerId:       player.id,
        playerName:     player.name,
        slotId:         assignment.slot.id,
        individualChem: chem,
        clubLinks:      clubBonus,
        leagueLinks:    leagueBonus,
        nationLinks:    nationBonus,
        isIcon:         player.isIcon,
        isHero:         player.isHero,
        notes,
      });
    }

    const total = clamp(
      breakdowns.reduce((sum, b) => sum + b.individualChem, 0),
      0,
      33,
    );

    return { total, players: breakdowns };
  }
}

// Default singleton — no manager configured
export const chemistryEngine = new FC26ChemistryEngine();
