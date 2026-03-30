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

const FORMATION_442: Formation = {
  name: '4-4-2',
  slots: [
    { id: 'GK', accepts: ['GK'], label: 'GK' },
    { id: 'RB', accepts: ['RB'], label: 'RB' },
    { id: 'CB1', accepts: ['CB'], label: 'CB' },
    { id: 'CB2', accepts: ['CB'], label: 'CB' },
    { id: 'LB', accepts: ['LB'], label: 'LB' },
    { id: 'RM', accepts: ['RM'], label: 'RM' },
    { id: 'CM1', accepts: ['CM'], label: 'CM' },
    { id: 'CM2', accepts: ['CM'], label: 'CM' },
    { id: 'LM', accepts: ['LM'], label: 'LM' },
    { id: 'ST1', accepts: ['ST'], label: 'ST' },
    { id: 'ST2', accepts: ['ST'], label: 'ST' },
  ],
};

function makePerfectLineup(): Lineup {
  // All 11 players from same club → all get max club links → 3 chem each
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
  // All players from different clubs/leagues/nations → 0 chem each
  const nations = ['Spain', 'France', 'Germany', 'Brazil', 'Argentina', 'England', 'Italy', 'Portugal', 'Netherlands', 'Belgium', 'Croatia'];
  const leagues = ['La Liga', 'Ligue 1', 'Bundesliga', 'Serie A', 'PL', 'Liga NOS', 'Eredivisie', 'Pro League', 'HNL', 'Super Lig', 'MLS'];
  const clubs   = ['Real Madrid', 'PSG', 'Bayern', 'Juventus', 'Arsenal', 'Benfica', 'Ajax', 'Anderlecht', 'Dinamo', 'Besiktas', 'LA Galaxy'];

  const players: PlayerCard[] = [
    makePlayer({ id: 'gk',  name: 'GK',  positions: ['GK'], nation: nations[0], league: leagues[0], club: clubs[0] }),
    makePlayer({ id: 'rb',  name: 'RB',  positions: ['RB'], nation: nations[1], league: leagues[1], club: clubs[1] }),
    makePlayer({ id: 'cb1', name: 'CB1', positions: ['CB'], nation: nations[2], league: leagues[2], club: clubs[2] }),
    makePlayer({ id: 'cb2', name: 'CB2', positions: ['CB'], nation: nations[3], league: leagues[3], club: clubs[3] }),
    makePlayer({ id: 'lb',  name: 'LB',  positions: ['LB'], nation: nations[4], league: leagues[4], club: clubs[4] }),
    makePlayer({ id: 'rm',  name: 'RM',  positions: ['RM'], nation: nations[5], league: leagues[5], club: clubs[5] }),
    makePlayer({ id: 'cm1', name: 'CM1', positions: ['CM'], nation: nations[6], league: leagues[6], club: clubs[6] }),
    makePlayer({ id: 'cm2', name: 'CM2', positions: ['CM'], nation: nations[7], league: leagues[7], club: clubs[7] }),
    makePlayer({ id: 'lm',  name: 'LM',  positions: ['LM'], nation: nations[8], league: leagues[8], club: clubs[8] }),
    makePlayer({ id: 'st1', name: 'ST1', positions: ['ST'], nation: nations[9], league: leagues[9], club: clubs[9] }),
    makePlayer({ id: 'st2', name: 'ST2', positions: ['ST'], nation: nations[10], league: leagues[10], club: clubs[10] }),
  ];

  return {
    formation: FORMATION_442,
    assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
  };
}

// ----------------------------------------------------------
// Tests
// ----------------------------------------------------------

describe('FC25ChemistryEngine', () => {
  const engine = new FC25ChemistryEngine();

  test('perfect club lineup gives 33 chemistry', () => {
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
    // Replace first player with an icon
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
    // Add extra icon that would push past 33
    lineup.assignments[0].player = makePlayer({
      id: 'icon_extra', name: 'Pele', positions: ['GK'],
      isIcon: true, cardType: 'icon',
    });
    const result = engine.calculateSquadChemistry(lineup);
    expect(result.total).toBeLessThanOrEqual(33);
  });

  test('nation-linked players get at least 1 chemistry', () => {
    const lineup = makeIsolatedLineup();
    // Give ST1 and ST2 (slots 9 and 10) the same unique nation, different from everyone else
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
    // Both players sharing a nation should each have at least 1 nation link
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
