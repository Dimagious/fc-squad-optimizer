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
