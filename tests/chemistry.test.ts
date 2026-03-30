// ============================================================
// tests/chemistry.test.ts — Unit tests for chemistry engine
// ============================================================

import { FC25ChemistryEngine } from '../src/chemistry/fc25';
import type { Lineup, PlayerCard, Formation } from '../src/types/index';

// ----------------------------------------------------------
// Fixtures
// ----------------------------------------------------------

function makePlayer(overrides: Partial<PlayerCard> & { id: string; name: string }): PlayerCard {
  return {
    rating: 80,
    nation: 'Spain',
    league: 'La Liga',
    club: 'Real Madrid',
    positions: ['ST'],
    cardType: 'gold',
    isIcon: false,
    isHero: false,
    ...overrides,
  };
}

// 4-4-2 with full adjacency map
//
//         ST1   ST2
//   LM  CM2  CM1  RM
//   LB  CB2  CB1  RB
//            GK
//
const FORMATION_442: Formation = {
  name: '4-4-2',
  slots: [
    { id: 'GK',  accepts: ['GK'],  label: 'GK' },
    { id: 'RB',  accepts: ['RB'],  label: 'RB' },
    { id: 'CB1', accepts: ['CB'],  label: 'CB' },
    { id: 'CB2', accepts: ['CB'],  label: 'CB' },
    { id: 'LB',  accepts: ['LB'],  label: 'LB' },
    { id: 'RM',  accepts: ['RM'],  label: 'RM' },
    { id: 'CM1', accepts: ['CM'],  label: 'CM' },
    { id: 'CM2', accepts: ['CM'],  label: 'CM' },
    { id: 'LM',  accepts: ['LM'],  label: 'LM' },
    { id: 'ST1', accepts: ['ST'],  label: 'ST' },
    { id: 'ST2', accepts: ['ST'],  label: 'ST' },
  ],
  adjacency: {
    GK:  ['RB', 'CB1', 'CB2', 'LB'],
    RB:  ['GK', 'CB1', 'RM'],
    CB1: ['GK', 'RB', 'CB2', 'CM1'],
    CB2: ['GK', 'CB1', 'LB', 'CM2'],
    LB:  ['GK', 'CB2', 'LM'],
    RM:  ['RB', 'CM1', 'ST1'],
    CM1: ['CB1', 'RM', 'CM2', 'ST1'],
    CM2: ['CB2', 'CM1', 'LM', 'ST2'],
    LM:  ['LB', 'CM2', 'ST2'],
    ST1: ['RM', 'CM1', 'ST2'],
    ST2: ['CM2', 'LM', 'ST1'],
  },
};

function makePerfectLineup(): Lineup {
  // All 11 players from same club → every adjacent pair shares club → 3 chem each
  const players: PlayerCard[] = [
    makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
    makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], nation: 'Spain', league: 'La Liga', club: 'Real Madrid' }),
  ];

  return {
    formation: FORMATION_442,
    assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
  };
}

function makeIsolatedLineup(): Lineup {
  // All players have completely different club/league/nation → 0 chem each
  const nations  = ['Spain',     'France',    'Germany', 'Brazil',  'Argentina', 'England', 'Italy',    'Portugal',   'Netherlands', 'Belgium',  'Croatia'];
  const leagues  = ['La Liga',   'Ligue 1',   'Bundesliga', 'Serie A', 'PL',     'Liga NOS','Eredivisie','Pro League', 'HNL',        'Super Lig','MLS'];
  const clubs    = ['Real Madrid','PSG',       'Bayern',  'Juventus','Arsenal', 'Benfica', 'Ajax',     'Anderlecht', 'Dinamo',     'Besiktas', 'LA Galaxy'];

  const players: PlayerCard[] = [
    makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], nation: nations[0],  league: leagues[0],  club: clubs[0] }),
    makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], nation: nations[1],  league: leagues[1],  club: clubs[1] }),
    makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], nation: nations[2],  league: leagues[2],  club: clubs[2] }),
    makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], nation: nations[3],  league: leagues[3],  club: clubs[3] }),
    makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], nation: nations[4],  league: leagues[4],  club: clubs[4] }),
    makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], nation: nations[5],  league: leagues[5],  club: clubs[5] }),
    makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], nation: nations[6],  league: leagues[6],  club: clubs[6] }),
    makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], nation: nations[7],  league: leagues[7],  club: clubs[7] }),
    makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], nation: nations[8],  league: leagues[8],  club: clubs[8] }),
    makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], nation: nations[9],  league: leagues[9],  club: clubs[9] }),
    makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], nation: nations[10], league: leagues[10], club: clubs[10] }),
  ];

  return {
    formation: FORMATION_442,
    assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
  };
}

// ----------------------------------------------------------
// Existing tests (unchanged behaviour)
// ----------------------------------------------------------

describe('FC25ChemistryEngine', () => {
  const engine = new FC25ChemistryEngine();

  test('perfect club lineup gives 33 chemistry', () => {
    // Each player has 2–4 adjacent same-club neighbours.
    // Minimum: 2 club links × 3 pts = 6 pts → 3 chem. All 11 reach max.
    const lineup = makePerfectLineup();
    const result = engine.calculateSquadChemistry(lineup);
    expect(result.total).toBe(33);
    expect(result.players).toHaveLength(11);
    expect(result.players.every(p => p.individualChem === 3)).toBe(true);
  });

  test('fully isolated lineup gives 0 chemistry', () => {
    const lineup = makeIsolatedLineup();
    const result = engine.calculateSquadChemistry(lineup);
    expect(result.total).toBe(0);
    expect(result.players.every(p => p.individualChem === 0)).toBe(true);
  });

  test('Icon always gets 3 individual chemistry', () => {
    const lineup = makeIsolatedLineup();
    lineup.assignments[0].player = makePlayer({
      id: 'icon1', name: 'Ronaldo Icon', positions: ['ST'],
      nation: 'Portugal', league: '', club: '',
      isIcon: true, cardType: 'icon',
    });

    const result = engine.calculateSquadChemistry(lineup);
    const iconBreakdown = result.players.find(p => p.isIcon);
    expect(iconBreakdown?.individualChem).toBe(3);
  });

  test('Hero always gets 3 individual chemistry', () => {
    const lineup = makeIsolatedLineup();
    lineup.assignments[0].player = makePlayer({
      id: 'hero1', name: 'Hero Player', positions: ['ST'],
      nation: 'Brazil', league: 'PL', club: 'Liverpool',
      isHero: true, cardType: 'hero',
    });

    const result = engine.calculateSquadChemistry(lineup);
    const heroBreakdown = result.players.find(p => p.isHero);
    expect(heroBreakdown?.individualChem).toBe(3);
  });

  test('total chemistry is capped at 33', () => {
    const lineup = makePerfectLineup();
    lineup.assignments[0].player = makePlayer({
      id: 'icon_extra', name: 'Pele', positions: ['GK'],
      isIcon: true, cardType: 'icon',
    });
    const result = engine.calculateSquadChemistry(lineup);
    expect(result.total).toBeLessThanOrEqual(33);
  });

  test('nation-linked adjacent players get at least 1 chemistry each', () => {
    // ST1 (slot 9) and ST2 (slot 10) are adjacent in 4-4-2.
    // Give them the same unique nation so each gets ≥1 nation link.
    const lineup = makeIsolatedLineup();
    const sharedNation = 'Iceland';
    lineup.assignments[9].player = makePlayer({
      id: 'st1_iceland', name: 'ST1_Iceland', positions: ['ST'],
      nation: sharedNation, league: 'Icelandic League', club: 'KR Reykjavik',
    });
    lineup.assignments[10].player = makePlayer({
      id: 'st2_iceland', name: 'ST2_Iceland', positions: ['ST'],
      nation: sharedNation, league: 'Allsvenskan', club: 'Malmo FF',
    });

    const result = engine.calculateSquadChemistry(lineup);
    const linked = result.players.filter(p => p.nationLinks > 0 && !p.isIcon && !p.isHero);
    expect(linked.length).toBeGreaterThanOrEqual(2);
  });

  test('chemistry breakdown has correct structure', () => {
    const lineup = makePerfectLineup();
    const result = engine.calculateSquadChemistry(lineup);

    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('players');
    expect(Array.isArray(result.players)).toBe(true);
    expect(result.players[0]).toHaveProperty('individualChem');
    expect(result.players[0]).toHaveProperty('nationLinks');
    expect(result.players[0]).toHaveProperty('leagueLinks');
    expect(result.players[0]).toHaveProperty('clubLinks');
    expect(result.players[0]).toHaveProperty('notes');
  });
});

// ----------------------------------------------------------
// Adjacency-specific tests
// These tests directly verify the new formation-adjacency model:
// non-adjacent players must NOT contribute to chemistry.
// ----------------------------------------------------------

describe('FC25ChemistryEngine — formation adjacency', () => {
  const engine = new FC25ChemistryEngine();

  test('non-adjacent same-club players do not contribute chemistry links', () => {
    // In 4-4-2, CM1 is adjacent to: CB1, RM, CM2, ST1.
    // Non-adjacent to CM1: GK, RB, CB2, LB, LM, ST2.
    //
    // Give CM1 and ALL non-adjacent players (GK, RB, CB2, LB, LM, ST2)
    // the same club ('BridgeClub').
    // Give CM1's actual neighbours (CB1, RM, CM2, ST1) completely different
    // and unique clubs so they contribute zero links.
    //
    // Expected: CM1 gets 0 chemistry (no adjacent club links).
    // With the old "all-teammates" model CM1 would have got 6 club links = 3 chem.

    const BRIDGE = 'BridgeClub';
    const players: PlayerCard[] = [
      makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], club: BRIDGE,   league: 'L0', nation: 'N0' }),
      makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], club: BRIDGE,   league: 'L1', nation: 'N1' }),
      makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], club: 'Club_A', league: 'LA', nation: 'NA' }), // adjacent
      makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], club: BRIDGE,   league: 'L3', nation: 'N3' }),
      makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], club: BRIDGE,   league: 'L4', nation: 'N4' }),
      makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], club: 'Club_B', league: 'LB', nation: 'NB' }), // adjacent
      makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], club: BRIDGE,   league: 'L6', nation: 'N6' }), // target
      makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], club: 'Club_C', league: 'LC', nation: 'NC' }), // adjacent
      makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], club: BRIDGE,   league: 'L8', nation: 'N8' }),
      makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], club: 'Club_D', league: 'LD', nation: 'ND' }), // adjacent
      makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], club: BRIDGE,   league: 'L10', nation: 'N10' }),
    ];

    const lineup: Lineup = {
      formation: FORMATION_442,
      assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
    };

    const result = engine.calculateSquadChemistry(lineup);
    const cm1 = result.players.find(p => p.playerId === 'cm1')!;

    expect(cm1.clubLinks).toBe(0);
    expect(cm1.leagueLinks).toBe(0);
    expect(cm1.nationLinks).toBe(0);
    expect(cm1.individualChem).toBe(0);
  });

  test('2 adjacent club links is enough for max (3) individual chemistry', () => {
    // ST2 adjacency in 4-4-2: [CM2, LM, ST1]
    // Give ST2, CM2, and LM the same club — 2 adjacent club links = 6 pts → 3 chem.
    // ST1 has a different club so it contributes 0.

    const CLUB = 'SharedClub';
    const players: PlayerCard[] = [
      makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], club: 'X1' }),
      makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], club: 'X2' }),
      makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], club: 'X3' }),
      makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], club: 'X4' }),
      makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], club: 'X5' }),
      makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], club: 'X6' }),
      makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], club: 'X7' }),
      makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], club: CLUB }),  // adjacent to ST2
      makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], club: CLUB }),  // adjacent to ST2
      makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], club: 'X10' }), // adjacent to ST2, different club
      makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], club: CLUB }),  // target
    ];

    const lineup: Lineup = {
      formation: FORMATION_442,
      assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
    };

    const result = engine.calculateSquadChemistry(lineup);
    const st2 = result.players.find(p => p.playerId === 'st2')!;

    expect(st2.clubLinks).toBe(2);
    expect(st2.individualChem).toBe(3);
  });

  test('1 adjacent club link gives 2 chemistry (3 pts)', () => {
    // ST1 adjacency: [RM, CM1, ST2]
    // Only ST2 shares ST1's club → 1 club link = 3 pts → 2 chemistry.
    // Every player has unique nation + league so no bleed-through links.

    const players: PlayerCard[] = [
      makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], club: 'X1',       nation: 'N1',  league: 'L1' }),
      makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], club: 'X2',       nation: 'N2',  league: 'L2' }),
      makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], club: 'X3',       nation: 'N3',  league: 'L3' }),
      makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], club: 'X4',       nation: 'N4',  league: 'L4' }),
      makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], club: 'X5',       nation: 'N5',  league: 'L5' }),
      makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], club: 'X6',       nation: 'N6',  league: 'L6' }), // adjacent, isolated
      makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], club: 'X7',       nation: 'N7',  league: 'L7' }), // adjacent, isolated
      makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], club: 'X8',       nation: 'N8',  league: 'L8' }),
      makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], club: 'X9',       nation: 'N9',  league: 'L9' }),
      makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], club: 'UniqueFC', nation: 'N10', league: 'L10' }), // target
      makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], club: 'UniqueFC', nation: 'N11', league: 'L11' }), // adjacent, same club
    ];

    const lineup: Lineup = {
      formation: FORMATION_442,
      assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
    };

    const result = engine.calculateSquadChemistry(lineup);
    const st1 = result.players.find(p => p.playerId === 'st1')!;

    expect(st1.clubLinks).toBe(1);
    expect(st1.individualChem).toBe(2); // 3 pts → 2 chem
  });

  test('non-adjacent same-nation player does not contribute to chemistry', () => {
    // CM1 (adjacent to CB1, RM, CM2, ST1) and GK share a nation.
    // GK is NOT adjacent to CM1. Only ST1 (adjacent) also has the shared nation.
    //
    // CM1's nation links should be 1 (from ST1 only), not 2.

    const NATION = 'Testland';
    const players: PlayerCard[] = [
      makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], nation: NATION, league: 'L0', club: 'C0' }), // NOT adjacent
      makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], nation: 'N1',   league: 'L1', club: 'C1' }),
      makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], nation: 'N2',   league: 'L2', club: 'C2' }), // adjacent, diff nation
      makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], nation: 'N3',   league: 'L3', club: 'C3' }),
      makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], nation: 'N4',   league: 'L4', club: 'C4' }),
      makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], nation: 'N5',   league: 'L5', club: 'C5' }), // adjacent, diff nation
      makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], nation: NATION, league: 'L6', club: 'C6' }), // target
      makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], nation: 'N7',   league: 'L7', club: 'C7' }), // adjacent, diff nation
      makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], nation: 'N8',   league: 'L8', club: 'C8' }),
      makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], nation: NATION, league: 'L9', club: 'C9' }), // adjacent, same nation
      makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], nation: 'N10',  league: 'L10', club: 'C10' }),
    ];

    const lineup: Lineup = {
      formation: FORMATION_442,
      assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
    };

    const result = engine.calculateSquadChemistry(lineup);
    const cm1 = result.players.find(p => p.playerId === 'cm1')!;

    // Only ST1 (adjacent) shares the nation — not GK (non-adjacent)
    expect(cm1.nationLinks).toBe(1);
    expect(cm1.individualChem).toBe(1); // 2 pts → 1 chem
  });

  test('Icon adjacent to isolated players bridges their chemistry', () => {
    // Isolated lineup. Replace GK with an Icon.
    // GK is adjacent to RB, CB1, CB2, LB.
    // Each of those 4 players should gain nation+league links from the Icon neighbour.
    const lineup = makeIsolatedLineup();
    lineup.assignments[0].player = makePlayer({
      id: 'icon_gk', name: 'Icon GK', positions: ['GK'],
      nation: 'Portugal', league: '', club: '',
      isIcon: true, cardType: 'icon',
    });

    const result = engine.calculateSquadChemistry(lineup);

    // Icon itself always gets 3
    const iconBreakdown = result.players.find(p => p.isIcon)!;
    expect(iconBreakdown.individualChem).toBe(3);

    // Defenders adjacent to the Icon should each get at least 1 chem
    // (they receive nation+league link from the Icon = 4 pts → 2 chem)
    const adjacentSlots = ['RB', 'CB1', 'CB2', 'LB'];
    for (const slotId of adjacentSlots) {
      const bd = result.players.find(p => p.slotId === slotId)!;
      expect(bd.individualChem).toBeGreaterThanOrEqual(2);
    }

    // Non-adjacent players (midfielders, strikers) should still have 0
    const nonAdjacentSlots = ['RM', 'CM1', 'CM2', 'LM', 'ST1', 'ST2'];
    for (const slotId of nonAdjacentSlots) {
      const bd = result.players.find(p => p.slotId === slotId)!;
      expect(bd.individualChem).toBe(0);
    }
  });

  test('GK chemistry is based solely on the 4 defenders', () => {
    // In 4-4-2, GK is adjacent only to RB, CB1, CB2, LB.
    // Give GK the same nation as all 4 defenders.
    // Give all 6 midfielders/forwards a different nation but same club as GK.
    // GK should count only nation links from defenders (4 × 2 pts = 8 → 3 chem),
    // and NOT count club links from the non-adjacent midfielders/strikers.

    const GK_NATION  = 'GKland';
    const GK_CLUB    = 'GK Club';

    const players: PlayerCard[] = [
      makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], nation: GK_NATION, club: GK_CLUB, league: 'L0' }),
      makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], nation: GK_NATION, club: 'C1',    league: 'L1' }), // same nation
      makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], nation: GK_NATION, club: 'C2',    league: 'L2' }), // same nation
      makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], nation: GK_NATION, club: 'C3',    league: 'L3' }), // same nation
      makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], nation: GK_NATION, club: 'C4',    league: 'L4' }), // same nation
      makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], nation: 'Other',   club: GK_CLUB, league: 'L5' }), // same club, non-adjacent
      makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], nation: 'Other',   club: GK_CLUB, league: 'L6' }), // same club, non-adjacent
      makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], nation: 'Other',   club: GK_CLUB, league: 'L7' }), // same club, non-adjacent
      makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], nation: 'Other',   club: GK_CLUB, league: 'L8' }), // same club, non-adjacent
      makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], nation: 'Other',   club: GK_CLUB, league: 'L9' }), // same club, non-adjacent
      makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], nation: 'Other',   club: GK_CLUB, league: 'L10' }), // same club, non-adjacent
    ];

    const lineup: Lineup = {
      formation: FORMATION_442,
      assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
    };

    const result = engine.calculateSquadChemistry(lineup);
    const gk = result.players.find(p => p.playerId === 'gk')!;

    // 4 nation links × 2 pts = 8 pts → 3 chemistry
    expect(gk.nationLinks).toBe(4);
    expect(gk.clubLinks).toBe(0);   // non-adjacent same-club players ignored
    expect(gk.individualChem).toBe(3);
  });
});
