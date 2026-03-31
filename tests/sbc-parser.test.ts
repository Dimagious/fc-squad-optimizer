import { parseSbcRequirements } from '../src/sbc/parser';

describe('SBC requirements parser', () => {
  test('parses canonical ChatGPT-friendly format', () => {
    const challenge = parseSbcRequirements(`
      Challenge Name: Italy v Northern Ireland
      Players in Squad: 11
      Nation: Italy OR Northern Ireland: Min 2 Players
      Players from the same Nation: Min 4
      Leagues in Squad: Max 4
      Clubs in Squad: Min 6
      Team Rating: Min 75
      Total Chemistry: Min 18
    `);

    expect(challenge.name).toBe('Italy v Northern Ireland');
    expect(challenge.squadSize).toBe(11);
    expect(challenge.minTeamRating).toBe(75);
    expect(challenge.minChemistry).toBe(18);
    expect(challenge.countConstraints).toEqual([
      expect.objectContaining({
        field: 'nation',
        values: ['Italy', 'Northern Ireland'],
        min: 2,
      }),
    ]);
    expect(challenge.sameBucketConstraints).toEqual([
      expect.objectContaining({
        field: 'nation',
        min: 4,
      }),
    ]);
    expect(challenge.distinctConstraints).toEqual([
      expect.objectContaining({
        field: 'league',
        max: 4,
      }),
      expect.objectContaining({
        field: 'club',
        min: 6,
      }),
    ]);
  });

  test('parses screenshot-like shorthand lines', () => {
    const challenge = parseSbcRequirements(`
      Challenge Name: Ukraine v Sweden
      Ukraine OR Sweden: Min. 2 Players
      Players from the same Club: Min. 2
      Clubs in Squad: Max. 5
      Rare: Min. 1 Players
      Team Rating: Min. 78
      Total Chemistry: Min. 26
    `);

    expect(challenge.countConstraints).toEqual([
      expect.objectContaining({ field: 'nation', values: ['Ukraine', 'Sweden'], min: 2 }),
      expect.objectContaining({ field: 'rarity', values: ['rare'], min: 1 }),
    ]);
    expect(challenge.sameBucketConstraints).toEqual([
      expect.objectContaining({ field: 'club', min: 2 }),
    ]);
    expect(challenge.distinctConstraints).toEqual([
      expect.objectContaining({ field: 'club', max: 5 }),
    ]);
  });
});
