import { parseSbcRequirements } from '../src/sbc/parser';
import { solveSbc } from '../src/sbc/solver';
import type { PlayerCard } from '../src/types/index';

function makePlayer(
  id: string,
  rating: number,
  nation: string,
  league: string,
  club: string,
  extras: Partial<PlayerCard> = {},
): PlayerCard {
  return {
    id,
    name: `Player_${id}`,
    rating,
    nation,
    league,
    club,
    positions: ['CM'],
    cardType: 'non_rare',
    isIcon: false,
    isHero: false,
    ...extras,
  };
}

describe('SBC solver', () => {
  test('solves a Ukraine v Sweden style challenge', () => {
    const players: PlayerCard[] = [
      makePlayer('ua1', 80, 'Ukraine', 'Nordic League', 'Club 1', { cardType: 'rare' }),
      makePlayer('ua2', 79, 'Ukraine', 'Nordic League', 'Club 1'),
      makePlayer('ua3', 79, 'Ukraine', 'Nordic League', 'Club 1'),
      makePlayer('ua4', 78, 'Ukraine', 'Nordic League', 'Club 2'),
      makePlayer('ua5', 78, 'Ukraine', 'Nordic League', 'Club 2'),
      makePlayer('ua6', 79, 'Ukraine', 'Nordic League', 'Club 3'),
      makePlayer('ua7', 78, 'Ukraine', 'Nordic League', 'Club 3'),
      makePlayer('ua8', 80, 'Ukraine', 'Nordic League', 'Club 4'),
      makePlayer('ua9', 78, 'Ukraine', 'Nordic League', 'Club 4'),
      makePlayer('ua10', 79, 'Ukraine', 'Nordic League', 'Club 5'),
      makePlayer('ua11', 78, 'Ukraine', 'Nordic League', 'Club 5'),

      // Cheap but structurally bad fillers
      makePlayer('bad1', 76, 'Spain', 'League A', 'A'),
      makePlayer('bad2', 76, 'France', 'League B', 'B'),
      makePlayer('bad3', 76, 'Germany', 'League C', 'C'),

      // Expensive cards the solver should avoid
      makePlayer('icon1', 91, 'Sweden', '', '', { cardType: 'icon', isIcon: true }),
      makePlayer('tots1', 93, 'Sweden', 'Nordic League', 'Club X', { cardType: 'tots' }),
    ];

    const challenge = parseSbcRequirements(`
      Challenge Name: Ukraine v Sweden
      Ukraine OR Sweden: Min. 2 Players
      Players from the same Club: Min. 2
      Clubs in Squad: Max. 5
      Rare: Min. 1 Players
      Team Rating: Min. 78
      Total Chemistry: Min. 26
    `);

    const result = solveSbc(players, challenge, { candidatePoolSizes: [18] });

    expect(result.solution).not.toBeNull();
    expect(result.solution?.teamRating).toBeGreaterThanOrEqual(78);
    expect(result.solution?.chemistry).toBeGreaterThanOrEqual(26);
    expect(result.solution?.statuses.every(status => status.ok)).toBe(true);

    const ids = result.solution?.players.map(card => card.player.id) ?? [];
    expect(ids).toContain('ua1');
    expect(ids).not.toContain('icon1');
    expect(ids).not.toContain('tots1');
  });
});
