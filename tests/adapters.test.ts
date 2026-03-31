import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseCSV } from '../src/adapters/index.js';

describe('parseCSV companion export support', () => {
  it('loads EA companion/web app exports with numeric positions and localized rarities', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-optimizer-adapters-'));
    const file = path.join(dir, 'club.csv');

    fs.writeFileSync(file, [
      'Id,Lastname,Name,Rating,Position,Rarity,Country,League,Club,Location',
      '212831,Ramses Becker,Alisson,89,0,Редкий,Brazil,Premier League,Liverpool,CLUB',
      '50339411,Pirlo,Andrea,91,18,КУМИР Временного разрыва,Italy,Кумиры,КУМИР,CLUB',
      '202126,Kane,Harry,89,25,Команда недели (TOTW),England,Bundesliga,FC Bayern München,CLUB',
      "202127,Ordinary,Left Back,83,7,Обычный,France,Ligue 1 McDonald's,Paris FC,CLUB",
      '999999,Placeholder,---,0,-1,Обычный,England,Premier League,Test FC,CLUB',
    ].join('\n'));

    const result = parseCSV(file);

    expect(result.detectedFormat).toBe('Companion / Web App export');
    expect(result.players).toHaveLength(4);
    expect(result.skippedRows).toBe(1);

    expect(result.players[0]).toMatchObject({
      name: 'Alisson Ramses Becker',
      positions: ['GK'],
      cardType: 'rare',
    });

    expect(result.players[1]).toMatchObject({
      name: 'Andrea Pirlo',
      positions: ['CAM'],
      cardType: 'icon',
      isIcon: true,
    });

    expect(result.players[2]).toMatchObject({
      name: 'Harry Kane',
      positions: ['ST'],
      cardType: 'special',
    });

    expect(result.players[3]).toMatchObject({
      positions: ['LB'],
      cardType: 'non_rare',
    });
  });
});
