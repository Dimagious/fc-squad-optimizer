// ============================================================
// tests/chemistry-fc26.test.ts — Unit tests for FC 26 chemistry engine
//
// FC 26 uses a SQUAD-WIDE THRESHOLD model:
//   Club  : ≥2 → +1 | ≥4 → +2 | ≥7 → +3
//   Nation: ≥2 → +1 | ≥5 → +2 | ≥8 → +3
//   League: ≥3 → +1 | ≥5 → +2 | ≥8 → +3
//   Icons : always 3 chem, +2 nation, +1 to every league counter
//   Heroes: always 3 chem, +1 nation, +2 league
//   Manager: +1 to all players sharing nation or league (capped at 3)
// ============================================================

import { FC26ChemistryEngine, type ManagerConfig } from '../src/chemistry/fc26';
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

// Minimal formation — adjacency is unused by FC26 engine but required by type
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

/**
 * Build a lineup from an array of 11 PlayerCards using FORMATION_442 slots in order.
 */
function makeLineup(players: PlayerCard[]): Lineup {
  if (players.length !== 11) throw new Error(`Expected 11 players, got ${players.length}`);
  return {
    formation: FORMATION_442,
    assignments: FORMATION_442.slots.map((slot, i) => ({ slot, player: players[i] })),
  };
}

/**
 * Create 11 players that are all completely isolated (unique nation/league/club each).
 * Good as a baseline for adding specific shared attributes.
 */
function makeIsolatedSquad(): PlayerCard[] {
  return Array.from({ length: 11 }, (_, i) =>
    makePlayer({
      id: `p${i}`,
      name: `Player${i}`,
      nation: `Nation${i}`,
      league: `League${i}`,
      club: `Club${i}`,
    }),
  );
}

// ----------------------------------------------------------
// Tests: threshold basics
// ----------------------------------------------------------

describe('FC26ChemistryEngine — threshold basics', () => {
  const engine = new FC26ChemistryEngine();

  test('fully isolated squad — each player gets 0 chemistry', () => {
    const lineup = makeLineup(makeIsolatedSquad());
    const result = engine.calculateSquadChemistry(lineup);

    expect(result.total).toBe(0);
    for (const p of result.players) {
      expect(p.individualChem).toBe(0);
    }
  });

  test('2 same-club players → each gets +1 club bonus', () => {
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'p0', name: 'P0', nation: 'Nation0', league: 'League0', club: 'SharedClub' });
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'Nation1', league: 'League1', club: 'SharedClub' });
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    expect(result.players[0].individualChem).toBe(1);
    expect(result.players[1].individualChem).toBe(1);
    expect(result.players[2].individualChem).toBe(0);
  });

  test('4 same-club players → club bonus becomes +2', () => {
    const squad = makeIsolatedSquad();
    for (let i = 0; i < 4; i++) {
      squad[i] = makePlayer({ id: `p${i}`, name: `P${i}`, nation: `N${i}`, league: `L${i}`, club: 'BigClub' });
    }
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    for (let i = 0; i < 4; i++) {
      expect(result.players[i].clubLinks).toBe(2);
      expect(result.players[i].individualChem).toBe(2);
    }
    expect(result.players[4].individualChem).toBe(0);
  });

  test('7 same-club players → club bonus becomes +3', () => {
    const squad = makeIsolatedSquad();
    for (let i = 0; i < 7; i++) {
      squad[i] = makePlayer({ id: `p${i}`, name: `P${i}`, nation: `N${i}`, league: `L${i}`, club: 'MegaClub' });
    }
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    for (let i = 0; i < 7; i++) {
      expect(result.players[i].clubLinks).toBe(3);
      expect(result.players[i].individualChem).toBe(3);
    }
  });

  test('nation threshold: 1 player → 0, 2 → +1, 5 → +2, 8 → +3', () => {
    const engine2 = new FC26ChemistryEngine();

    const testNation = (count: number, expectedBonus: number) => {
      const squad = makeIsolatedSquad();
      for (let i = 0; i < count; i++) {
        squad[i] = makePlayer({ id: `p${i}`, name: `P${i}`, nation: 'SharedNation', league: `L${i}`, club: `C${i}` });
      }
      const lineup = makeLineup(squad);
      const result = engine2.calculateSquadChemistry(lineup);
      if (count >= 1) {
        expect(result.players[0].nationLinks).toBe(expectedBonus);
      }
    };

    testNation(1, 0);
    testNation(2, 1);
    testNation(5, 2);
    testNation(8, 3);
  });

  test('league threshold: 2 players → 0, 3 → +1, 5 → +2, 8 → +3', () => {
    const testLeague = (count: number, expectedBonus: number) => {
      const squad = makeIsolatedSquad();
      for (let i = 0; i < count; i++) {
        squad[i] = makePlayer({ id: `p${i}`, name: `P${i}`, nation: `N${i}`, league: 'SharedLeague', club: `C${i}` });
      }
      const lineup = makeLineup(squad);
      const result = engine.calculateSquadChemistry(lineup);
      expect(result.players[0].leagueLinks).toBe(expectedBonus);
    };

    testLeague(2, 0);
    testLeague(3, 1);
    testLeague(5, 2);
    testLeague(8, 3);
  });

  test('individual chem capped at 3 even when bonuses sum higher', () => {
    // Player in 7-club (bonus 3) + 8-nation (bonus 3) + 8-league (bonus 3) group
    // All 11 share the same club, nation, and league
    const squad = Array.from({ length: 11 }, (_, i) =>
      makePlayer({ id: `p${i}`, name: `P${i}`, nation: 'SameNation', league: 'SameLeague', club: 'SameClub' }),
    );
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    for (const p of result.players) {
      expect(p.individualChem).toBe(3);
    }
    expect(result.total).toBe(33);
  });

  test('total chemistry capped at 33', () => {
    const squad = Array.from({ length: 11 }, (_, i) =>
      makePlayer({ id: `p${i}`, name: `P${i}`, nation: 'SameNation', league: 'SameLeague', club: 'SameClub' }),
    );
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);
    expect(result.total).toBeLessThanOrEqual(33);
  });

  test('mixed bonuses add correctly — 1 club + 1 league bonus = chem 2', () => {
    // 2 share club → +1 club bonus
    // 3 share league (those 2 + 1 more) → +1 league bonus
    const squad = makeIsolatedSquad();
    // Players 0 and 1: same club, same league
    squad[0] = makePlayer({ id: 'p0', name: 'P0', nation: 'N0', league: 'SharedLeague', club: 'SharedClub' });
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'N1', league: 'SharedLeague', club: 'SharedClub' });
    // Player 2: only in same league (3rd league player → threshold reached)
    squad[2] = makePlayer({ id: 'p2', name: 'P2', nation: 'N2', league: 'SharedLeague', club: 'OtherClub' });

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const p0 = result.players[0];
    expect(p0.clubLinks).toBe(1);
    expect(p0.leagueLinks).toBe(1);
    expect(p0.individualChem).toBe(2);

    const p2 = result.players[2];
    expect(p2.clubLinks).toBe(0);
    expect(p2.leagueLinks).toBe(1);
    expect(p2.individualChem).toBe(1);
  });
});

// ----------------------------------------------------------
// Tests: Icons
// ----------------------------------------------------------

describe('FC26ChemistryEngine — Icons', () => {
  const engine = new FC26ChemistryEngine();

  test('Icon always gets 3 individual chemistry', () => {
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'icon', name: 'Icon', isIcon: true, nation: 'Brazil', league: '', club: '' });
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    expect(result.players[0].individualChem).toBe(3);
    expect(result.players[0].isIcon).toBe(true);
  });

  test('Icon contributes +2 to nation counter of its nation', () => {
    // 1 Icon (Brazil) = +2 nation increments → meets the 2-player threshold (+1 bonus)
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'icon', name: 'Icon', isIcon: true, nation: 'Brazil', league: '', club: '' });
    // Add one real Brazilian player who should get +1 nation bonus
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'Brazil', league: 'League1', club: 'Club1' });

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    // The Icon contributes 2 increments → total Brazil nation count = 2 + 1 = 3 → still threshold ≥2 → +1
    // The regular Brazilian player (p1) should get nationLinks = 1
    const regularBrazilian = result.players.find(p => p.playerId === 'p1')!;
    expect(regularBrazilian.nationLinks).toBe(1);
    expect(regularBrazilian.individualChem).toBe(1);
  });

  test('Icon adds +1 to every league counter (iconCount effect)', () => {
    // 2 players in 'La Liga' normally need 3 for the +1 bonus.
    // 1 Icon anywhere → adds +1 to every league → effectively 3 La Liga players → bonus triggers
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'icon', name: 'Icon', isIcon: true, nation: 'Brazil', league: '', club: '' });
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'N1', league: 'La Liga', club: 'C1' });
    squad[2] = makePlayer({ id: 'p2', name: 'P2', nation: 'N2', league: 'La Liga', club: 'C2' });
    // 2 La Liga players + 1 icon = effective 3 → league threshold ≥3 → +1

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const p1 = result.players.find(p => p.playerId === 'p1')!;
    expect(p1.leagueLinks).toBe(1);
    expect(p1.individualChem).toBe(1);
  });

  test('2 Icons make every league threshold easier to hit', () => {
    // 2 Icons → +2 added to every league counter
    // 1 La Liga player: effective count = 1 + 2 = 3 → +1 league bonus
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'icon1', name: 'Icon1', isIcon: true, nation: 'Brazil', league: '', club: '' });
    squad[1] = makePlayer({ id: 'icon2', name: 'Icon2', isIcon: true, nation: 'Argentina', league: '', club: '' });
    squad[2] = makePlayer({ id: 'p2', name: 'P2', nation: 'N2', league: 'La Liga', club: 'C2' });

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const p2 = result.players.find(p => p.playerId === 'p2')!;
    expect(p2.leagueLinks).toBe(1);
    expect(p2.individualChem).toBe(1);
  });
});

// ----------------------------------------------------------
// Tests: Heroes
// ----------------------------------------------------------

describe('FC26ChemistryEngine — Heroes', () => {
  const engine = new FC26ChemistryEngine();

  test('Hero always gets 3 individual chemistry', () => {
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'hero', name: 'Hero', isHero: true, nation: 'France', league: 'Ligue 1', club: '' });
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    expect(result.players[0].individualChem).toBe(3);
    expect(result.players[0].isHero).toBe(true);
  });

  test('Hero contributes +2 to its league counter', () => {
    // 1 Hero (Ligue 1) = +2 league increments → effective Ligue 1 count = 2 (below 3 threshold)
    // Add 1 real Ligue 1 player: count = 2 + 1 = 3 → +1 league bonus
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'hero', name: 'Hero', isHero: true, nation: 'France', league: 'Ligue 1', club: '' });
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'N1', league: 'Ligue 1', club: 'C1' });

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const p1 = result.players.find(p => p.playerId === 'p1')!;
    expect(p1.leagueLinks).toBe(1);
    expect(p1.individualChem).toBe(1);
  });

  test('Hero contributes +1 to its nation counter', () => {
    // 1 Hero (France) = +1 nation increment
    // 1 real French player → total = 1 + 1 = 2 → ≥2 threshold → +1 nation bonus
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'hero', name: 'Hero', isHero: true, nation: 'France', league: 'Ligue 1', club: '' });
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'France', league: 'L1', club: 'C1' });

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const p1 = result.players.find(p => p.playerId === 'p1')!;
    expect(p1.nationLinks).toBe(1);
    expect(p1.individualChem).toBe(1);
  });

  test('Hero does not contribute to club counter', () => {
    // Hero should NOT add to club thresholds
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'hero', name: 'Hero', isHero: true, nation: 'N0', league: 'L0', club: 'SharedClub' });
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'N1', league: 'L1', club: 'SharedClub' });
    // If Hero didn't contribute to club, only 1 regular player has SharedClub → below threshold

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const p1 = result.players.find(p => p.playerId === 'p1')!;
    expect(p1.clubLinks).toBe(0); // no club bonus — hero doesn't count
    expect(p1.individualChem).toBe(0);
  });
});

// ----------------------------------------------------------
// Tests: Manager bonus
// ----------------------------------------------------------

describe('FC26ChemistryEngine — Manager bonus', () => {
  test('manager nation match gives +1 to matching players', () => {
    const manager: ManagerConfig = { nation: 'Spain' };
    const engine = new FC26ChemistryEngine(manager);

    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'p0', name: 'P0', nation: 'Spain', league: 'League0', club: 'Club0' });

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    expect(result.players[0].individualChem).toBe(1); // manager bonus alone
    expect(result.players[1].individualChem).toBe(0); // no match
  });

  test('manager league match gives +1 to matching players', () => {
    const manager: ManagerConfig = { league: 'Premier League' };
    const engine = new FC26ChemistryEngine(manager);

    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'p0', name: 'P0', nation: 'Nation0', league: 'Premier League', club: 'Club0' });

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    expect(result.players[0].individualChem).toBe(1);
    expect(result.players[1].individualChem).toBe(0);
  });

  test('manager bonus does not exceed cap of 3', () => {
    // Player already at 3 chem — manager bonus should not push above 3
    const manager: ManagerConfig = { nation: 'SameNation' };
    const engine = new FC26ChemistryEngine(manager);

    // All 11 share club (7 → +3), all same nation → manager +1, but cap at 3
    const squad = Array.from({ length: 11 }, (_, i) =>
      makePlayer({ id: `p${i}`, name: `P${i}`, nation: 'SameNation', league: `L${i}`, club: 'MegaClub' }),
    );

    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    for (const p of result.players) {
      expect(p.individualChem).toBe(3);
    }
    expect(result.total).toBe(33);
  });

  test('manager without nation or league has no effect', () => {
    const engine = new FC26ChemistryEngine({});
    const squad = makeIsolatedSquad();
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    for (const p of result.players) {
      expect(p.individualChem).toBe(0);
    }
  });

  test('undefined manager config has no effect', () => {
    const engine = new FC26ChemistryEngine(undefined);
    const squad = makeIsolatedSquad();
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    for (const p of result.players) {
      expect(p.individualChem).toBe(0);
    }
  });
});

// ----------------------------------------------------------
// Tests: result structure / breakdown fields
// ----------------------------------------------------------

describe('FC26ChemistryEngine — breakdown fields', () => {
  const engine = new FC26ChemistryEngine();

  test('players array has 11 entries matching each assignment', () => {
    const lineup = makeLineup(makeIsolatedSquad());
    const result = engine.calculateSquadChemistry(lineup);

    expect(result.players).toHaveLength(11);
    for (let i = 0; i < 11; i++) {
      expect(result.players[i].playerId).toBe(`p${i}`);
      expect(result.players[i].slotId).toBe(FORMATION_442.slots[i].id);
    }
  });

  test('breakdown notes include reason string for club/nation/league bonuses', () => {
    const squad = makeIsolatedSquad();
    // 2 same-club players → +1 club bonus
    squad[0] = makePlayer({ id: 'p0', name: 'P0', nation: 'N0', league: 'L0', club: 'SharedClub' });
    squad[1] = makePlayer({ id: 'p1', name: 'P1', nation: 'N1', league: 'L1', club: 'SharedClub' });
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const p0notes = result.players[0].notes;
    expect(p0notes.some(n => n.includes('Club'))).toBe(true);
  });

  test('Icon breakdown notes mention Icon behaviour', () => {
    const squad = makeIsolatedSquad();
    squad[0] = makePlayer({ id: 'icon', name: 'Icon', isIcon: true, nation: 'Brazil', league: '', club: '' });
    const lineup = makeLineup(squad);
    const result = engine.calculateSquadChemistry(lineup);

    const iconNotes = result.players[0].notes;
    expect(iconNotes.some(n => n.toLowerCase().includes('icon'))).toBe(true);
  });

  test('isolated player note mentions no thresholds reached', () => {
    const lineup = makeLineup(makeIsolatedSquad());
    const result = engine.calculateSquadChemistry(lineup);

    const p0notes = result.players[0].notes;
    expect(p0notes.some(n => n.toLowerCase().includes('isolated') || n.toLowerCase().includes('no threshold'))).toBe(true);
  });
});

// ----------------------------------------------------------
// Tests: engine singleton export
// ----------------------------------------------------------

describe('FC26ChemistryEngine — chemistryEngine singleton', () => {
  test('default export is a valid FC26ChemistryEngine instance', async () => {
    const { chemistryEngine } = await import('../src/chemistry/fc26');
    expect(chemistryEngine).toBeInstanceOf(FC26ChemistryEngine);
  });

  test('singleton produces same result as explicit engine for full-chem squad', async () => {
    const { chemistryEngine } = await import('../src/chemistry/fc26');
    const squad = Array.from({ length: 11 }, (_, i) =>
      makePlayer({ id: `p${i}`, name: `P${i}`, nation: 'SameNation', league: 'SameLeague', club: 'SameClub' }),
    );
    const lineup = makeLineup(squad);
    const result = chemistryEngine.calculateSquadChemistry(lineup);
    expect(result.total).toBe(33);
  });
});
