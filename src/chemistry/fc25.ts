// ============================================================
// chemistry/fc25.ts — EA FC 25 Chemistry Engine
//
// ASSUMPTIONS (document here when rules are uncertain):
//
// 1. Individual player chemistry (0–3) is determined by how many
//    of their neighbors (adjacent in formation) share their
//    nation, league, or club. FC 25 uses a "link" model.
//
// 2. A player's neighbors are the other 10 players in the lineup.
//    In reality FC uses adjacency by formation layout; we use
//    a simplified "all teammates are neighbors" model here.
//    This slightly overestimates chemistry for wide players, but
//    is a good approximation without full pitch-layout data.
//    TODO: add formation-adjacency mapping for precise calculation.
//
// 3. Chemistry links:
//    - CLUB link:   player shares club with neighbor → strongest link
//    - LEAGUE link: player shares league with neighbor → medium link
//    - NATION link: player shares nation with neighbor → medium link
//
// 4. Individual chem scoring (FC 25 approximation):
//    - 3 chem: player has strong connections (club + anything, or 3+ links)
//    - 2 chem: player has 2 meaningful links
//    - 1 chem: player has 1 link
//    - 0 chem: player has no connections to teammates
//
// 5. Icons: always receive 3 individual chemistry regardless of links.
//    They provide a "ghost link" that counts as a nation+league link
//    to ALL teammates (they bridge any hybrid).
//
// 6. Heroes: always receive 3 individual chemistry.
//    They provide a league link to ALL teammates in the same league,
//    and a nation link to ALL teammates of the same nation.
//
// 7. Squad chemistry = sum of all 11 individual chemistries → max 33.
//
// 8. Chemistry affects in-game stats: each point of individual chem
//    above 0 boosts the player's in-game attributes positively.
//    We don't model the attribute boost here; we optimize for chem score.
//
// SOURCES:
//   EA FC 25 Chemistry Guide (community-verified, Nov 2024)
//   https://www.ea.com/games/ea-sports-fc/fc-25/news/chemistry
// ============================================================

import type {
  ChemistryEngine,
  ChemistryBreakdown,
  Lineup,
  PlayerCard,
  PlayerChemistryBreakdown,
} from '../types/index.js';

// How many "connection points" are needed to reach each chemistry level.
// Adjustable here without touching the rest of the engine.
const CHEM_THRESHOLDS = {
  level3: 6, // ≥6 points → 3 chemistry
  level2: 3, // ≥3 points → 2 chemistry
  level1: 1, // ≥1 point  → 1 chemistry
} as const;

// Point values per link type
const LINK_POINTS = {
  club:   3,
  league: 2,
  nation: 2,
} as const;

// How many "effective neighbor" points an Icon/Hero generates per teammate
// (they act as universal bridges)
const ICON_LINK_BONUS = 5;   // effectively gives all teammates 3 chem easily
const HERO_LINK_BONUS_SAME_LEAGUE = 2;
const HERO_LINK_BONUS_SAME_NATION = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate connection points from one player's perspective
 * looking at all other players in the lineup.
 */
function calculateConnectionPoints(
  player: PlayerCard,
  teammates: PlayerCard[],
): { nationLinks: number; leagueLinks: number; clubLinks: number; totalPoints: number } {
  let nationLinks = 0;
  let leagueLinks = 0;
  let clubLinks = 0;

  for (const teammate of teammates) {
    if (teammate.id === player.id) continue;

    // Icons provide a universal bridge to everyone
    if (teammate.isIcon) {
      // Icon contributes as if they share nation AND league
      nationLinks += 1;
      leagueLinks += 1;
      continue;
    }

    // Heroes provide league-based bridge
    if (teammate.isHero) {
      if (teammate.league === player.league && player.league !== '') {
        leagueLinks += 1;
      }
      if (teammate.nation === player.nation && player.nation !== '') {
        nationLinks += 1;
      }
      continue;
    }

    // Normal link calculation
    if (teammate.club !== '' && teammate.club === player.club) {
      clubLinks += 1;
    } else if (teammate.league !== '' && teammate.league === player.league) {
      leagueLinks += 1;
    } else if (teammate.nation !== '' && teammate.nation === player.nation) {
      nationLinks += 1;
    }
    // Note: only the strongest link type is counted per pair
    // (club > league > nation, mutually exclusive per teammate)
  }

  const totalPoints =
    Math.min(clubLinks, 10) * LINK_POINTS.club +
    Math.min(leagueLinks, 10) * LINK_POINTS.league +
    Math.min(nationLinks, 10) * LINK_POINTS.nation;

  return { nationLinks, leagueLinks, clubLinks, totalPoints };
}

function pointsToIndividualChem(points: number): number {
  if (points >= CHEM_THRESHOLDS.level3) return 3;
  if (points >= CHEM_THRESHOLDS.level2) return 2;
  if (points >= CHEM_THRESHOLDS.level1) return 1;
  return 0;
}

function buildPlayerChemBreakdown(
  player: PlayerCard,
  slotId: string,
  teammates: PlayerCard[],
): PlayerChemistryBreakdown {
  const notes: string[] = [];

  // Icons and Heroes always get full individual chemistry
  if (player.isIcon) {
    notes.push('Icon — always 3 individual chemistry, bridges all connections');
    return {
      playerId: player.id,
      playerName: player.name,
      slotId,
      individualChem: 3,
      nationLinks: 0,
      leagueLinks: 0,
      clubLinks: 0,
      isIcon: true,
      isHero: false,
      notes,
    };
  }

  if (player.isHero) {
    notes.push('Hero — always 3 individual chemistry, provides league bridge');
    return {
      playerId: player.id,
      playerName: player.name,
      slotId,
      individualChem: 3,
      nationLinks: 0,
      leagueLinks: 0,
      clubLinks: 0,
      isIcon: false,
      isHero: true,
      notes,
    };
  }

  const { nationLinks, leagueLinks, clubLinks, totalPoints } =
    calculateConnectionPoints(player, teammates);

  const individualChem = pointsToIndividualChem(totalPoints);

  if (clubLinks > 0) notes.push(`${clubLinks} club link(s)`);
  if (leagueLinks > 0) notes.push(`${leagueLinks} league link(s)`);
  if (nationLinks > 0) notes.push(`${nationLinks} nation link(s)`);
  if (individualChem === 0) notes.push('No connections — isolated player');

  return {
    playerId: player.id,
    playerName: player.name,
    slotId,
    individualChem,
    nationLinks,
    leagueLinks,
    clubLinks,
    isIcon: false,
    isHero: false,
    notes,
  };
}

// ----------------------------------------------------------
// FC25ChemistryEngine — implements ChemistryEngine interface
// ----------------------------------------------------------

export class FC25ChemistryEngine implements ChemistryEngine {
  calculateSquadChemistry(lineup: Lineup): ChemistryBreakdown {
    const players = lineup.assignments.map(a => a.player);
    const breakdowns: PlayerChemistryBreakdown[] = [];

    for (const assignment of lineup.assignments) {
      const breakdown = buildPlayerChemBreakdown(
        assignment.player,
        assignment.slot.id,
        players,
      );
      breakdowns.push(breakdown);
    }

    const total = clamp(
      breakdowns.reduce((sum, b) => sum + b.individualChem, 0),
      0,
      33,
    );

    return { total, players: breakdowns };
  }
}

// Default singleton export
export const chemistryEngine = new FC25ChemistryEngine();
