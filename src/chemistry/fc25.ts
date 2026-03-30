// ============================================================
// chemistry/fc25.ts — EA FC 25 Chemistry Engine
//
// ASSUMPTIONS (document here when rules are uncertain):
//
// 1. Individual player chemistry (0–3) is determined by how many
//    of their ADJACENT neighbours (as defined by the formation's
//    adjacency map) share their nation, league, or club.
//    Only directly connected slots count — non-adjacent players
//    are invisible to the chemistry calculation.
//
// 2. Chemistry links:
//    - CLUB link:   player shares club with a neighbour → strongest link
//    - LEAGUE link: player shares league with a neighbour → medium link
//    - NATION link: player shares nation with a neighbour → medium link
//    Only the strongest link type is counted per pair
//    (club > league > nation, mutually exclusive per neighbour).
//
// 3. Individual chem scoring (FC 25):
//    - ≥6 connection points → 3 chemistry
//    - ≥3 connection points → 2 chemistry
//    - ≥1 connection point  → 1 chemistry
//    - 0 points             → 0 chemistry
//
// 4. Icons: always receive 3 individual chemistry regardless of links.
//    From every adjacent player's perspective, an Icon counts as sharing
//    their nation AND league (universal bridge for adjacent teammates).
//
// 5. Heroes: always receive 3 individual chemistry.
//    From adjacent teammates' perspective, a Hero provides:
//    - A league link to same-league neighbours.
//    - A nation link to same-nation neighbours.
//
// 6. Squad chemistry = sum of all 11 individual chemistries → max 33.
//
// 7. Chemistry affects in-game stats: each point of individual chem
//    above 0 boosts the player's in-game attributes positively.
//    We don't model the attribute boost here; we optimise for chem score.
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Resolve which PlayerCards are the direct neighbours of a given slot
 * using the formation's adjacency map.
 */
function getAdjacentPlayers(
  slotId: string,
  lineup: Lineup,
): PlayerCard[] {
  const neighbourIds = lineup.formation.adjacency[slotId] ?? [];
  return lineup.assignments
    .filter(a => neighbourIds.includes(a.slot.id))
    .map(a => a.player);
}

/**
 * Calculate connection points from one player's perspective,
 * looking only at their adjacent neighbours.
 */
function calculateConnectionPoints(
  player: PlayerCard,
  neighbours: PlayerCard[],
): { nationLinks: number; leagueLinks: number; clubLinks: number; totalPoints: number } {
  let nationLinks = 0;
  let leagueLinks = 0;
  let clubLinks = 0;

  for (const neighbour of neighbours) {
    if (neighbour.id === player.id) continue;

    // Icons provide a universal bridge to every adjacent player
    if (neighbour.isIcon) {
      // Icon counts as sharing both nation AND league with any adjacent player
      nationLinks += 1;
      leagueLinks += 1;
      continue;
    }

    // Heroes provide a league-based bridge to adjacent same-league players
    // and a nation bridge to adjacent same-nation players
    if (neighbour.isHero) {
      if (neighbour.league === player.league && player.league !== '') {
        leagueLinks += 1;
      }
      if (neighbour.nation === player.nation && player.nation !== '') {
        nationLinks += 1;
      }
      continue;
    }

    // Normal link — only the strongest type is counted per neighbour pair
    if (neighbour.club !== '' && neighbour.club === player.club) {
      clubLinks += 1;
    } else if (neighbour.league !== '' && neighbour.league === player.league) {
      leagueLinks += 1;
    } else if (neighbour.nation !== '' && neighbour.nation === player.nation) {
      nationLinks += 1;
    }
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
  neighbours: PlayerCard[],
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
    calculateConnectionPoints(player, neighbours);

  const individualChem = pointsToIndividualChem(totalPoints);

  if (clubLinks > 0)   notes.push(`${clubLinks} club link(s)`);
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
    const breakdowns: PlayerChemistryBreakdown[] = [];

    for (const assignment of lineup.assignments) {
      // Only pass the directly adjacent players — this is the key change
      // from the previous "all teammates are neighbours" model.
      const neighbours = getAdjacentPlayers(assignment.slot.id, lineup);

      const breakdown = buildPlayerChemBreakdown(
        assignment.player,
        assignment.slot.id,
        neighbours,
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
