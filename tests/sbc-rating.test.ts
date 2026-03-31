import { calculateSbcTeamRating } from '../src/sbc/rating';

describe('SBC rating formula', () => {
  test('matches a known 11-card example', () => {
    const ratings = [85, 87, 83, 86, 84, 88, 82, 85, 86, 84, 87];
    expect(calculateSbcTeamRating(ratings)).toBe(85);
  });

  test('pads partial squads to 11 cards before calculation', () => {
    expect(calculateSbcTeamRating([85, 85, 85])).toBe(40);
  });

  test('common 83-rated SBC pattern resolves to 83', () => {
    const ratings = [84, 83, 83, 83, 83, 83, 83, 82, 82, 82, 82];
    expect(calculateSbcTeamRating(ratings)).toBe(83);
  });
});
