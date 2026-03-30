// tests/optimizer.test.ts

import { findBestLineups } from '../src/optimizer/index';
import { FC25ChemistryEngine } from '../src/chemistry/fc25';
import { SCORING_PRESETS } from '../src/scorer/index';
import { ALL_FORMATIONS } from '../src/formations/index';
import type { PlayerCard } from '../src/types/index';

function makePlayer(id: string, rating: number, positions: PlayerCard['positions'], extras: Partial<PlayerCard> = {}): PlayerCard {
  return {
    id, name: `Player_${id}`, rating,
    nation: 'Spain', league: 'La Liga', club: 'Real Madrid',
    positions, cardType: 'gold',
    isIcon: false, isHero: false,
    ...extras,
  };
}

// Minimal 15-player squad covering all position types
function makeSquad(): PlayerCard[] {
  return [
    makePlayer('gk1', 85, ['GK']),
    makePlayer('gk2', 80, ['GK']),
    makePlayer('rb1', 84, ['RB']),
    makePlayer('rb2', 79, ['RB']),
    makePlayer('lb1', 83, ['LB']),
    makePlayer('lb2', 78, ['LB']),
    makePlayer('cb1', 87, ['CB']),
    makePlayer('cb2', 85, ['CB']),
    makePlayer('cb3', 82, ['CB']),
    makePlayer('cm1', 86, ['CM', 'CDM']),
    makePlayer('cm2', 84, ['CM', 'CAM']),
    makePlayer('cm3', 82, ['CM']),
    makePlayer('st1', 90, ['ST']),
    makePlayer('st2', 88, ['ST', 'CF']),
    makePlayer('lw1', 86, ['LW', 'LM']),
    makePlayer('rw1', 85, ['RW', 'RM']),
    makePlayer('cam1', 87, ['CAM', 'CM']),
  ];
}

describe('Optimizer', () => {
  const chemEngine = new FC25ChemistryEngine();

  test('finds a valid lineup for a basic squad', () => {
    const result = findBestLineups(makeSquad(), {
      mode: 'balanced',
      config: SCORING_PRESETS['balanced'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 10,
      topN: 3,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    const best = result.rankedLineups[0];
    expect(best.lineup.assignments).toHaveLength(11);
  });

  test('each player in lineup is unique', () => {
    const result = findBestLineups(makeSquad(), {
      mode: 'max-chem',
      config: SCORING_PRESETS['max-chem'],
      chemEngine,
      formations: [ALL_FORMATIONS[0]],
      candidateLimit: 10,
      topN: 1,
    });

    if (result.rankedLineups.length > 0) {
      const ids = result.rankedLineups[0].lineup.assignments.map(a => a.player.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(11);
    }
  });

  test('all-same-club squad should achieve high chemistry', () => {
    const squad = makeSquad().map(p => ({
      ...p,
      nation: 'England',
      league: 'Premier League',
      club: 'Manchester City',
    }));

    const result = findBestLineups(squad, {
      mode: 'max-chem',
      config: SCORING_PRESETS['max-chem'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 5),
      candidateLimit: 15,
      topN: 3,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    const best = result.rankedLineups[0];
    // All same club → should be 33
    expect(best.score.totalChemistry).toBe(33);
  });

  test('max-rating mode selects highest overall ratings', () => {
    // Add some very high-rated but chemically incompatible cards
    const squad = makeSquad();
    squad.push(
      makePlayer('star1', 99, ['ST'], { nation: 'Brazil', league: 'Serie A', club: 'Flamengo' }),
      makePlayer('star2', 98, ['CB'], { nation: 'Argentina', league: 'MLS', club: 'Inter Miami' }),
    );

    const ratingResult = findBestLineups(squad, {
      mode: 'max-rating',
      config: SCORING_PRESETS['max-rating'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 1,
    });

    const chemResult = findBestLineups(squad, {
      mode: 'max-chem',
      config: SCORING_PRESETS['max-chem'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 1,
    });

    if (ratingResult.rankedLineups.length > 0 && chemResult.rankedLineups.length > 0) {
      // max-rating should prefer higher total rating
      expect(ratingResult.rankedLineups[0].score.totalRating)
        .toBeGreaterThanOrEqual(chemResult.rankedLineups[0].score.totalRating - 5);
    }
  });

  test('formations tried count is correct', () => {
    const result = findBestLineups(makeSquad(), {
      mode: 'balanced',
      config: SCORING_PRESETS['balanced'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 4),
      candidateLimit: 5,
      topN: 3,
    });

    expect(result.formationsTried + result.formationsSkipped).toBe(4);
  });
});

// ----------------------------------------------------------
// Bronze / silver filtering
// ----------------------------------------------------------

describe('Optimizer — bronze/silver filtering', () => {
  const chemEngine = new FC25ChemistryEngine();

  test('bronze cards never appear in result lineup, even with high rating', () => {
    const squad = [
      ...makeSquad(),
      makePlayer('bronze_st', 99, ['ST'], { cardType: 'bronze' }),
      makePlayer('bronze_cb', 98, ['CB'], { cardType: 'bronze' }),
    ];

    const result = findBestLineups(squad, {
      mode: 'max-rating',
      config: SCORING_PRESETS['max-rating'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 3,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    for (const rl of result.rankedLineups) {
      for (const a of rl.lineup.assignments) {
        expect(a.player.cardType).not.toBe('bronze');
      }
    }
  });

  test('silver cards never appear in result lineup, even with high rating', () => {
    const squad = [
      ...makeSquad(),
      makePlayer('silver_st', 97, ['ST'], { cardType: 'silver' }),
      makePlayer('silver_gk', 96, ['GK'], { cardType: 'silver' }),
    ];

    const result = findBestLineups(squad, {
      mode: 'max-rating',
      config: SCORING_PRESETS['max-rating'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 3,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    for (const rl of result.rankedLineups) {
      for (const a of rl.lineup.assignments) {
        expect(a.player.cardType).not.toBe('silver');
      }
    }
  });

  test('special cards (icon, hero, tots) are never filtered', () => {
    // Replace the two STs in the squad with an icon and a hero
    const squad = makeSquad().filter(p => p.id !== 'st1' && p.id !== 'st2');
    squad.push(
      makePlayer('icon_st', 91, ['ST'], { cardType: 'icon', isIcon: true, club: '', league: '' }),
      makePlayer('hero_st', 89, ['ST', 'CF'], { cardType: 'hero', isHero: true }),
    );

    const result = findBestLineups(squad, {
      mode: 'balanced',
      config: SCORING_PRESETS['balanced'],
      chemEngine,
      formations: [ALL_FORMATIONS.find(f => f.name === '4-4-2')!],
      candidateLimit: 15,
      topN: 1,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    const playerIds = result.rankedLineups[0].lineup.assignments.map(a => a.player.id);
    // At least one special card must have made it into the lineup
    const hasSpecial = playerIds.includes('icon_st') || playerIds.includes('hero_st');
    expect(hasSpecial).toBe(true);
  });

  test('tots and potm cards are never filtered', () => {
    const squad = makeSquad().filter(p => p.id !== 'st1');
    squad.push(makePlayer('tots_st', 93, ['ST'], { cardType: 'tots' }));

    const result = findBestLineups(squad, {
      mode: 'balanced',
      config: SCORING_PRESETS['balanced'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 1,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    const playerIds = result.rankedLineups[0].lineup.assignments.map(a => a.player.id);
    expect(playerIds).toContain('tots_st');
  });

  test('formation is skipped when a slot has only bronze/silver candidates', () => {
    // Squad where GK position has only bronze cards
    const noGoldGK = makeSquad().filter(p => !p.positions.includes('GK'));
    noGoldGK.push(makePlayer('bronze_gk', 70, ['GK'], { cardType: 'bronze' }));

    const result = findBestLineups(noGoldGK, {
      mode: 'balanced',
      config: SCORING_PRESETS['balanced'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 3,
    });

    // All formations should be skipped because no eligible GK
    expect(result.formationsSkipped).toBe(3);
    expect(result.rankedLineups).toHaveLength(0);
  });
});

// ----------------------------------------------------------
// Chemistry-aware candidate sorting
// ----------------------------------------------------------

describe('Optimizer — chemistry-aware sorting', () => {
  const chemEngine = new FC25ChemistryEngine();

  test('in max-chem mode, connected 85-rated player beats isolated 88-rated player', () => {
    // 10 players from a single club + nation at various positions
    const dominantClub = 'FC Connected';
    const dominantNation = 'Testland';
    const dominantLeague = 'Test League';

    // 4-3-3 needs GK, RB, CB×2, LB, CM×3, RW, ST, LW — provide all slots
    const baseSquad: PlayerCard[] = [
      makePlayer('gk',  84, ['GK'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('rb',  82, ['RB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cb1', 83, ['CB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cb2', 82, ['CB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('lb',  81, ['LB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cm1', 84, ['CM'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cm2', 83, ['CM'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cm3', 82, ['CM'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('lw',  82, ['LW', 'LM'],{ club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('rw',  82, ['RW', 'RM'],{ club: dominantClub, nation: dominantNation, league: dominantLeague }),
      // Connected ST: 85 rated, part of dominant club
      makePlayer('st_connected', 85, ['ST'], { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      // Isolated ST: 88 rated, completely different background
      makePlayer('st_isolated', 88, ['ST'], { club: 'Isolated FC', nation: 'Isolonia', league: 'Isolation League' }),
    ];

    const result = findBestLineups(baseSquad, {
      mode: 'max-chem',
      config: SCORING_PRESETS['max-chem'],
      chemEngine,
      formations: [ALL_FORMATIONS.find(f => f.name === '4-3-3')!],
      candidateLimit: 10,
      topN: 1,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    const best = result.rankedLineups[0];
    // max-chem mode: losing 3 chemistry (33→30) costs far more than the 3-rating gain.
    // The optimizer should exclude the isolated player entirely.
    const playerIds = best.lineup.assignments.map(a => a.player.id);
    expect(playerIds).not.toContain('st_isolated');
    expect(best.score.totalChemistry).toBe(33);
  });

  test('in max-rating mode, isolated high-rated player beats connected lower-rated player', () => {
    const dominantClub = 'FC Connected';
    const dominantNation = 'Testland';
    const dominantLeague = 'Test League';

    // 4-3-3 needs GK, RB, CB×2, LB, CM×3, RW, ST, LW — provide all slots
    const baseSquad: PlayerCard[] = [
      makePlayer('gk',  84, ['GK'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('rb',  82, ['RB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cb1', 83, ['CB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cb2', 82, ['CB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('lb',  81, ['LB'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cm1', 84, ['CM'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cm2', 83, ['CM'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('cm3', 82, ['CM'],       { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('lw',  82, ['LW', 'LM'],{ club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('rw',  82, ['RW', 'RM'],{ club: dominantClub, nation: dominantNation, league: dominantLeague }),
      makePlayer('st_connected', 85, ['ST'], { club: dominantClub, nation: dominantNation, league: dominantLeague }),
      // Rating gap is 10 pts — too large for the chemistry bonus to overcome
      makePlayer('st_isolated', 95, ['ST'], { club: 'Isolated FC', nation: 'Isolonia', league: 'Isolation League' }),
    ];

    const result = findBestLineups(baseSquad, {
      mode: 'max-rating',
      config: SCORING_PRESETS['max-rating'],
      chemEngine,
      formations: [ALL_FORMATIONS.find(f => f.name === '4-3-3')!],
      candidateLimit: 10,
      topN: 1,
    });

    expect(result.rankedLineups.length).toBeGreaterThan(0);
    const best = result.rankedLineups[0];
    // A 10-rating gap means the isolated player's contribution outweighs
    // the chemistry cost (3 pts) in max-rating mode — it must appear somewhere.
    const playerIds = best.lineup.assignments.map(a => a.player.id);
    expect(playerIds).toContain('st_isolated');
    expect(best.score.totalRating).toBeGreaterThan(910);
  });

  test('chemistry of result is higher with connected squad than isolated squad', () => {
    // Verify that chemistry-aware sorting actually produces better chemistry outcomes
    const connectedSquad = makeSquad().map(p => ({
      ...p,
      nation: 'Spain',
      league: 'La Liga',
      club: 'Barcelona',
    }));

    const isolatedSquad = makeSquad().map((p, i) => ({
      ...p,
      nation: `Nation_${i}`,
      league: `League_${i}`,
      club: `Club_${i}`,
    }));

    const connResult = findBestLineups(connectedSquad, {
      mode: 'max-chem',
      config: SCORING_PRESETS['max-chem'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 1,
    });

    const isolResult = findBestLineups(isolatedSquad, {
      mode: 'max-chem',
      config: SCORING_PRESETS['max-chem'],
      chemEngine,
      formations: ALL_FORMATIONS.slice(0, 3),
      candidateLimit: 15,
      topN: 1,
    });

    expect(connResult.rankedLineups[0].score.totalChemistry).toBeGreaterThan(
      isolResult.rankedLineups[0].score.totalChemistry,
    );
  });
});
