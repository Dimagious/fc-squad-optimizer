// ============================================================
// tests/optimizer-pool.test.ts
// Unit tests for pool frequency analysis and connectivity scoring
// ============================================================

import { buildPoolFrequency, computeConnectivity } from '../src/optimizer/index';
import type { PlayerCard } from '../src/types/index';

function makePlayer(
  id: string,
  extras: Partial<PlayerCard> = {},
): PlayerCard {
  return {
    id,
    name: `Player_${id}`,
    rating: 80,
    nation: 'Spain',
    league: 'La Liga',
    club: 'Real Madrid',
    positions: ['ST'],
    cardType: 'gold',
    isIcon: false,
    isHero: false,
    ...extras,
  };
}

// ----------------------------------------------------------
// buildPoolFrequency
// ----------------------------------------------------------

describe('buildPoolFrequency', () => {
  test('counts club, league, and nation frequencies correctly', () => {
    const players = [
      makePlayer('a', { club: 'Arsenal', league: 'PL', nation: 'England' }),
      makePlayer('b', { club: 'Arsenal', league: 'PL', nation: 'England' }),
      makePlayer('c', { club: 'Chelsea', league: 'PL', nation: 'France' }),
    ];

    const freq = buildPoolFrequency(players);

    expect(freq.club['Arsenal']).toBe(2);
    expect(freq.club['Chelsea']).toBe(1);
    expect(freq.league['PL']).toBe(3);
    expect(freq.nation['England']).toBe(2);
    expect(freq.nation['France']).toBe(1);
  });

  test('empty player list returns empty frequency maps', () => {
    const freq = buildPoolFrequency([]);
    expect(Object.keys(freq.club)).toHaveLength(0);
    expect(Object.keys(freq.league)).toHaveLength(0);
    expect(Object.keys(freq.nation)).toHaveLength(0);
  });

  test('ignores empty string values for club, league, nation', () => {
    // Icons/special cards often have empty club or league
    const players = [
      makePlayer('icon', { club: '', league: '', nation: 'Portugal' }),
      makePlayer('hero', { club: '', league: 'PL', nation: 'Brazil' }),
    ];

    const freq = buildPoolFrequency(players);

    expect(freq.club['']).toBeUndefined();
    expect(freq.league['']).toBeUndefined();
    expect(freq.league['PL']).toBe(1);
    expect(freq.nation['Portugal']).toBe(1);
    expect(freq.nation['Brazil']).toBe(1);
  });

  test('single player produces frequency of 1 for each of their values', () => {
    const players = [makePlayer('solo', { club: 'Juventus', league: 'Serie A', nation: 'Italy' })];
    const freq = buildPoolFrequency(players);

    expect(freq.club['Juventus']).toBe(1);
    expect(freq.league['Serie A']).toBe(1);
    expect(freq.nation['Italy']).toBe(1);
  });

  test('all players from same club/league/nation increment counts correctly', () => {
    const players = Array.from({ length: 11 }, (_, i) =>
      makePlayer(`p${i}`, { club: 'Bayern', league: 'Bundesliga', nation: 'Germany' }),
    );

    const freq = buildPoolFrequency(players);

    expect(freq.club['Bayern']).toBe(11);
    expect(freq.league['Bundesliga']).toBe(11);
    expect(freq.nation['Germany']).toBe(11);
  });

  test('does not count clubs from other players under wrong key', () => {
    const players = [
      makePlayer('x', { club: 'Barcelona', league: 'La Liga', nation: 'Spain' }),
      makePlayer('y', { club: 'Real Madrid', league: 'La Liga', nation: 'Spain' }),
    ];

    const freq = buildPoolFrequency(players);

    expect(freq.club['Barcelona']).toBe(1);
    expect(freq.club['Real Madrid']).toBe(1);
    expect(freq.club['Atletico']).toBeUndefined();
  });
});

// ----------------------------------------------------------
// computeConnectivity
// ----------------------------------------------------------

describe('computeConnectivity', () => {
  test('player from dominant club has highest connectivity', () => {
    const players = [
      makePlayer('a', { club: 'City', league: 'PL', nation: 'England' }),
      makePlayer('b', { club: 'City', league: 'PL', nation: 'England' }),
      makePlayer('c', { club: 'City', league: 'PL', nation: 'England' }),
      makePlayer('lone', { club: 'Loner FC', league: 'Unknown', nation: 'Isolonia' }),
    ];

    const freq = buildPoolFrequency(players);
    const cityPlayer = players[0];
    const lonePlayer = players[3];

    expect(computeConnectivity(cityPlayer, freq)).toBeGreaterThan(
      computeConnectivity(lonePlayer, freq),
    );
  });

  test('isolated player has minimal connectivity', () => {
    const players = [
      makePlayer('solo', { club: 'Unique FC', league: 'Unique League', nation: 'Uniqueland' }),
      makePlayer('other1', { club: 'Other1', league: 'Other League', nation: 'Otherland' }),
      makePlayer('other2', { club: 'Other2', league: 'Other League 2', nation: 'Otherland 2' }),
    ];

    const freq = buildPoolFrequency(players);
    const solo = players[0];
    // Each value appears exactly once — connectivity comes only from the player themself
    // Club: 1 * 3 = 3, League: 1 * 1 = 1, Nation: 1 * 1 = 1 → total = 5
    expect(computeConnectivity(solo, freq)).toBe(5);
  });

  test('club links outweigh league and nation links individually', () => {
    // Player A: 3 club links, no league/nation matches in pool
    // Player B: no club links, 6 nation links in pool
    const poolForA = [
      makePlayer('a1', { club: 'ClubA', league: 'L1', nation: 'N1' }),
      makePlayer('a2', { club: 'ClubA', league: 'L2', nation: 'N2' }),
      makePlayer('a3', { club: 'ClubA', league: 'L3', nation: 'N3' }),
    ];
    const poolForB = [
      makePlayer('b1', { club: 'B1', league: 'L9', nation: 'NationX' }),
      makePlayer('b2', { club: 'B2', league: 'L9', nation: 'NationX' }),
      makePlayer('b3', { club: 'B3', league: 'L9', nation: 'NationX' }),
      makePlayer('b4', { club: 'B4', league: 'L9', nation: 'NationX' }),
      makePlayer('b5', { club: 'B5', league: 'L9', nation: 'NationX' }),
      makePlayer('b6', { club: 'B6', league: 'L9', nation: 'NationX' }),
    ];

    const freqA = buildPoolFrequency(poolForA);
    const freqB = buildPoolFrequency(poolForB);

    const playerA = makePlayer('target_a', { club: 'ClubA', league: 'L_unique', nation: 'N_unique' });
    const playerB = makePlayer('target_b', { club: 'ClubB_unique', league: 'L_unique2', nation: 'NationX' });

    // A has 3 club links → 3*3=9; B has 6 nation links → 6*1=6
    expect(computeConnectivity(playerA, freqA)).toBeGreaterThan(
      computeConnectivity(playerB, freqB),
    );
  });

  test('player with empty club does not get club connectivity', () => {
    // Icon-style player with empty club
    const players = [
      makePlayer('icon', { club: '', league: 'PL', nation: 'England' }),
      makePlayer('p2',   { club: '', league: 'PL', nation: 'England' }),
    ];

    const freq = buildPoolFrequency(players);
    const icon = players[0];

    const connectivity = computeConnectivity(icon, freq);
    // No club points (empty string ignored), but league + nation contribute
    expect(connectivity).toBeGreaterThan(0);
    // Club key '' should not contribute since buildPoolFrequency skips empty strings
    expect(freq.club['']).toBeUndefined();
  });

  test('connectivity increases as more players share the same club', () => {
    const player = makePlayer('target', { club: 'FC Test', league: 'Test League', nation: 'Testland' });

    const pool1 = [player, makePlayer('p1', { club: 'FC Test', league: 'Test League', nation: 'Testland' })];
    const pool5 = [
      player,
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer(`p${i}`, { club: 'FC Test', league: 'Test League', nation: 'Testland' }),
      ),
    ];

    const freq1 = buildPoolFrequency(pool1);
    const freq5 = buildPoolFrequency(pool5);

    expect(computeConnectivity(player, freq5)).toBeGreaterThan(
      computeConnectivity(player, freq1),
    );
  });

  test('computeConnectivity returns 0 for a player not present in frequency map', () => {
    // Player whose club/league/nation don't appear in the pool freq
    const poolPlayers = [
      makePlayer('p1', { club: 'Arsenal', league: 'PL', nation: 'England' }),
    ];
    const freq = buildPoolFrequency(poolPlayers);

    const outsider = makePlayer('outsider', { club: 'Unknown', league: 'Unknown', nation: 'Unknown' });
    expect(computeConnectivity(outsider, freq)).toBe(0);
  });
});
