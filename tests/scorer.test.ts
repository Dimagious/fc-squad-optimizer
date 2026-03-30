// tests/scorer.test.ts

import { scoreLineup, SCORING_PRESETS, compareScores } from '../src/scorer/index';
import { FC25ChemistryEngine } from '../src/chemistry/fc25';
import type { Lineup, PlayerCard, Formation, LineupScore } from '../src/types/index';

function makePlayer(id: string, rating: number, extras: Partial<PlayerCard> = {}): PlayerCard {
  return {
    id, name: id, rating,
    nation: 'Spain', league: 'La Liga', club: 'Real Madrid',
    positions: ['ST'], cardType: 'gold',
    isIcon: false, isHero: false,
    ...extras,
  };
}

const FORMATION: Formation = {
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

function makeUniformLineup(rating: number): Lineup {
  const players = [
    makePlayer('gk',  rating, { positions: ['GK'] }),
    makePlayer('rb',  rating, { positions: ['RB'] }),
    makePlayer('cb1', rating, { positions: ['CB'] }),
    makePlayer('cb2', rating, { positions: ['CB'] }),
    makePlayer('lb',  rating, { positions: ['LB'] }),
    makePlayer('rm',  rating, { positions: ['RM'] }),
    makePlayer('cm1', rating, { positions: ['CM'] }),
    makePlayer('cm2', rating, { positions: ['CM'] }),
    makePlayer('lm',  rating, { positions: ['LM'] }),
    makePlayer('st1', rating, { positions: ['ST'] }),
    makePlayer('st2', rating, { positions: ['ST'] }),
  ];

  return {
    formation: FORMATION,
    assignments: FORMATION.slots.map((slot, i) => ({ slot, player: players[i] })),
  };
}

describe('Scorer', () => {
  const engine = new FC25ChemistryEngine();

  test('scoreLineup returns correct total rating', () => {
    const lineup = makeUniformLineup(85);
    const chem = engine.calculateSquadChemistry(lineup);
    const score = scoreLineup(lineup, chem, SCORING_PRESETS['balanced']);

    expect(score.totalRating).toBe(85 * 11);
    expect(score.averageRating).toBeCloseTo(85, 1);
  });

  test('higher rating lineup scores higher in max-rating mode', () => {
    const high = makeUniformLineup(90);
    const low  = makeUniformLineup(80);
    const config = SCORING_PRESETS['max-rating'];

    const chemHigh = engine.calculateSquadChemistry(high);
    const chemLow  = engine.calculateSquadChemistry(low);

    const scoreHigh = scoreLineup(high, chemHigh, config);
    const scoreLow  = scoreLineup(low,  chemLow,  config);

    expect(scoreHigh.finalScore).toBeGreaterThan(scoreLow.finalScore);
  });

  test('compareScores — max-chem prioritizes chemistry', () => {
    const a: LineupScore = { totalChemistry: 33, strengthScore: 900, totalRating: 850, averageRating: 85, finalScore: 0.9 };
    const b: LineupScore = { totalChemistry: 27, strengthScore: 950, totalRating: 900, averageRating: 90, finalScore: 0.95 };

    expect(compareScores(a, b, 'max-chem')).toBeGreaterThan(0); // a wins due to chemistry
    expect(compareScores(b, a, 'max-chem')).toBeLessThan(0);
  });

  test('compareScores — max-rating prioritizes total rating', () => {
    const a: LineupScore = { totalChemistry: 33, strengthScore: 900, totalRating: 850, averageRating: 85, finalScore: 0.9 };
    const b: LineupScore = { totalChemistry: 20, strengthScore: 950, totalRating: 950, averageRating: 95, finalScore: 0.7 };

    expect(compareScores(b, a, 'max-rating')).toBeGreaterThan(0); // b wins due to rating
  });

  test('all scoring presets have valid weights summing close to 1', () => {
    for (const [mode, config] of Object.entries(SCORING_PRESETS)) {
      const total = config.chemistryWeight + config.strengthWeight + config.ratingWeight;
      expect(total).toBeCloseTo(1.0, 5);
    }
  });
});
