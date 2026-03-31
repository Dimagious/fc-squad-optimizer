// ============================================================
// adapters/index.ts — CSV parsing and normalization pipeline
//
// Architecture:
//   1. CSVAdapter interface — each adapter handles a specific format
//   2. AdapterRegistry — auto-detects format from header row
//   3. GenericAdapter — fallback with fuzzy column matching
//   4. parse() — main entry point
// ============================================================

import { parse as csvParse } from 'csv-parse/sync';
import * as fs from 'fs';
import type { PlayerCard, CardType, PositionCode } from '../types/index.js';

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface CSVAdapter {
  /** Returns true if this adapter can handle the given CSV headers */
  canHandle(headers: string[]): boolean;
  /** Normalize a raw CSV row into a PlayerCard */
  normalize(row: Record<string, string>, index: number): PlayerCard | null;
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-\.]/g, '');
}

function fuzzyFind(headers: string[], candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const norm = normalize(candidate);
    const found = headers.find(h => normalize(h) === norm);
    if (found) return found;
  }
  // Partial match fallback
  for (const candidate of candidates) {
    const norm = normalize(candidate);
    const found = headers.find(h => normalize(h).includes(norm) || norm.includes(normalize(h)));
    if (found) return found;
  }
  return undefined;
}

const KNOWN_POSITIONS: PositionCode[] = [
  'GK', 'RB', 'LB', 'CB', 'RWB', 'LWB',
  'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST',
];

const NUMERIC_POSITION_MAP: Record<string, PositionCode> = {
  '0': 'GK',
  '3': 'RB',
  '5': 'CB',
  '7': 'LB',
  '10': 'CDM',
  '12': 'RM',
  '14': 'CM',
  '16': 'LM',
  '18': 'CAM',
  '23': 'RW',
  '25': 'ST',
  '27': 'LW',
};

function parsePositionToken(raw: string): PositionCode | null {
  const token = raw.trim().toUpperCase();
  if (!token) return null;
  if (KNOWN_POSITIONS.includes(token as PositionCode)) {
    return token as PositionCode;
  }
  return NUMERIC_POSITION_MAP[raw.trim()] ?? null;
}

function parsePositions(raw: string): PositionCode[] {
  if (!raw) return [];
  const positions = raw
    .split(/[,|\/;\s]+/)
    .map(part => parsePositionToken(part))
    .filter((part): part is PositionCode => part !== null);
  return [...new Set(positions)];
}

function buildPlayerName(
  primaryName: string | undefined,
  lastName?: string | undefined,
): string {
  const first = (primaryName ?? '').trim();
  const last = (lastName ?? '').trim();

  if (!first) return '';
  if (!last) return first;
  if (normalize(first).includes(normalize(last))) return first;

  return `${first} ${last}`.trim();
}

function isPlaceholderName(name: string): boolean {
  return name.replace(/[-\s]/g, '') === '';
}

function detectCardType(raw: string): CardType {
  const s = (raw ?? '').toLowerCase().replace(/[\s_:\-]/g, '');
  if (s.includes('icon') || s.includes('кумир')) return 'icon';
  if (s.includes('hero') || s.includes('герой')) return 'hero';
  if (s.includes('totw')) return 'totw';
  if (s.includes('toty')) return 'toty';
  if (s.includes('tots')) return 'tots';
  if (s.includes('potm')) return 'potm';
  if (s.includes('birthday') || s.includes('деньрожденияfut')) return 'fut_birthday';
  if (
    s.includes('special') ||
    s.includes('fantasyfc') ||
    s.includes('ретроспектива') ||
    s.includes('будущиезвезды') ||
    s.includes('мировоетурне') ||
    s.includes('почетноеупоминание') ||
    s.includes('ответитьнавызов') ||
    s.includes('плейоффаристократии') ||
    s.includes('развитиемировоготурне')
  ) return 'special';
  if (
    s.includes('raregreen') ||
    s.includes('rareblue') ||
    s === 'rare' ||
    s === 'редкий'
  ) return 'rare';
  if (s === 'nonrare' || s === 'обычный') return 'non_rare';
  if (s.includes('gold') || s.includes('золото')) return 'gold';
  if (s.includes('silver') || s.includes('серебр')) return 'silver';
  if (s.includes('bronze') || s.includes('бронз')) return 'bronze';
  return 'unknown';
}

function safeInt(raw: string | undefined, fallback = 0): number {
  const n = parseInt((raw ?? '').replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? fallback : n;
}

// ----------------------------------------------------------
// Generic Adapter — fuzzy column matching
// Works for Club Analyzer, manual exports, and most FC tools
// ----------------------------------------------------------

export class GenericAdapter implements CSVAdapter {
  canHandle(_headers: string[]): boolean {
    return true; // Always falls back to this
  }

  normalize(row: Record<string, string>, index: number): PlayerCard | null {
    const headers = Object.keys(row);

    const nameCol    = fuzzyFind(headers, ['name', 'player', 'playername', 'player name']);
    const lastNameCol = fuzzyFind(headers, ['lastname', 'last name', 'surname', 'family name']);
    const ratingCol  = fuzzyFind(headers, ['rating', 'overall', 'ovr', 'ova', 'pac+sho+pas+dri+def+phy', 'total stats']);
    const nationCol  = fuzzyFind(headers, ['nation', 'nationality', 'country']);
    const leagueCol  = fuzzyFind(headers, ['league', 'competition']);
    const clubCol    = fuzzyFind(headers, ['club', 'team']);
    const posCol     = fuzzyFind(headers, ['position', 'positions', 'pos', 'altpos', 'alt positions']);
    const cardCol    = fuzzyFind(headers, ['cardtype', 'card type', 'rarity', 'type', 'version']);

    // Additional columns that Club Analyzer typically exports
    const altPosCol  = fuzzyFind(headers, ['altpos', 'alt pos', 'alternate positions', 'other positions']);

    if (!nameCol) return null;

    const name = buildPlayerName(row[nameCol], row[lastNameCol ?? '']);
    if (!name || isPlaceholderName(name)) return null;

    const rawCardType = row[cardCol ?? ''] ?? '';
    const cardType = detectCardType(rawCardType);

    // Merge primary + alt positions
    let rawPos = posCol ? (row[posCol] ?? '') : '';
    if (altPosCol && row[altPosCol]) rawPos += ',' + row[altPosCol];
    const positions = parsePositions(rawPos);

    // Rating: try direct column, fallback to computing from stat columns
    let rating = ratingCol ? safeInt(row[ratingCol]) : 0;
    if (rating === 0) {
      // Try to find any column with a high numeric value (likely overall)
      for (const [key, val] of Object.entries(row)) {
        const n = safeInt(val);
        if (n >= 40 && n <= 99 && normalize(key).includes('ovr')) {
          rating = n;
          break;
        }
      }
    }
    if (rating === 0) rating = 70; // default fallback

    const card: PlayerCard = {
      id:        `player_${index}_${name.replace(/\s+/g, '_')}`,
      name,
      rating:    Math.min(99, Math.max(1, rating)),
      nation:    (row[nationCol ?? ''] ?? '').trim(),
      league:    (row[leagueCol ?? ''] ?? '').trim(),
      club:      (row[clubCol ?? ''] ?? '').trim(),
      positions,
      cardType,
      isIcon:    cardType === 'icon',
      isHero:    cardType === 'hero',
      _raw:      row,
    };

    return card;
  }
}

// ----------------------------------------------------------
// Companion / Web App club export
// Headers: Id, Lastname, Name, Rating, Position, Rarity, Country, League, Club
// ----------------------------------------------------------

export class CompanionClubExportAdapter implements CSVAdapter {
  private static KNOWN_HEADERS = ['id', 'lastname', 'name', 'rating', 'position', 'rarity', 'country', 'league', 'club'];

  canHandle(headers: string[]): boolean {
    const normalized = headers.map(normalize);
    return CompanionClubExportAdapter.KNOWN_HEADERS.every(kh =>
      normalized.some(h => h === kh)
    );
  }

  normalize(row: Record<string, string>, index: number): PlayerCard | null {
    const rawPosition = row['Position'] ?? row['position'] ?? '';
    if (rawPosition.trim().startsWith('-')) return null;

    const name = buildPlayerName(
      row['Name'] ?? row['name'],
      row['Lastname'] ?? row['LastName'] ?? row['lastname'],
    );
    if (!name || isPlaceholderName(name)) return null;

    const rawCard = row['Rarity'] ?? row['rarity'] ?? '';
    const cardType = detectCardType(rawCard);

    return {
      id:        `companion_${row['Id'] ?? row['id'] ?? index}`,
      name,
      rating:    Math.min(99, Math.max(1, safeInt(row['Rating'] ?? row['rating'], 70))),
      nation:    (row['Country'] ?? row['country'] ?? '').trim(),
      league:    (row['League'] ?? row['league'] ?? '').trim(),
      club:      (row['Club'] ?? row['club'] ?? '').trim(),
      positions: parsePositions(rawPosition),
      cardType,
      isIcon:    cardType === 'icon',
      isHero:    cardType === 'hero',
      _raw:      row,
    };
  }
}

// ----------------------------------------------------------
// Club Analyzer specific adapter
// Headers: Name, Overall, Position, Alt Pos, Club, League, Nation, Card Type
// ----------------------------------------------------------

export class ClubAnalyzerAdapter implements CSVAdapter {
  private static KNOWN_HEADERS = ['overall', 'alt pos', 'card type'];

  canHandle(headers: string[]): boolean {
    const normalized = headers.map(h => h.toLowerCase());
    return ClubAnalyzerAdapter.KNOWN_HEADERS.every(kh =>
      normalized.some(h => h.includes(kh.replace(' ', '')))
    );
  }

  normalize(row: Record<string, string>, index: number): PlayerCard | null {
    const name    = (row['Name'] ?? row['name'] ?? '').trim();
    if (!name) return null;

    const ratingRaw = row['Overall'] ?? row['overall'] ?? row['Rating'] ?? '';
    const rating    = Math.min(99, Math.max(1, safeInt(ratingRaw, 70)));

    const mainPos   = row['Position'] ?? row['position'] ?? '';
    const altPos    = row['Alt Pos'] ?? row['alt pos'] ?? row['AltPos'] ?? '';
    const positions = parsePositions(`${mainPos},${altPos}`);

    const rawCard   = row['Card Type'] ?? row['card type'] ?? row['CardType'] ?? '';
    const cardType  = detectCardType(rawCard);

    return {
      id:        `ca_${index}_${name.replace(/\s+/g, '_')}`,
      name,
      rating,
      nation:    (row['Nation'] ?? row['nation'] ?? '').trim(),
      league:    (row['League'] ?? row['league'] ?? '').trim(),
      club:      (row['Club'] ?? row['club'] ?? '').trim(),
      positions,
      cardType,
      isIcon:    cardType === 'icon',
      isHero:    cardType === 'hero',
      _raw:      row,
    };
  }
}

// ----------------------------------------------------------
// FUTWIZ / FUTbin export adapter
// ----------------------------------------------------------

export class FutwizAdapter implements CSVAdapter {
  canHandle(headers: string[]): boolean {
    const normalized = headers.map(h => h.toLowerCase());
    return normalized.includes('pac') && normalized.includes('sho') && normalized.includes('dri');
  }

  normalize(row: Record<string, string>, index: number): PlayerCard | null {
    const name = (row['Name'] ?? row['name'] ?? row['Player'] ?? '').trim();
    if (!name) return null;

    // FUTWIZ uses individual stats — compute overall as avg
    const stats = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'].map(s =>
      safeInt(row[s] ?? row[s.toLowerCase()])
    );
    const statAvg = stats.reduce((a, b) => a + b, 0) / stats.length;

    const overallRaw = row['OVR'] ?? row['Overall'] ?? row['Rating'] ?? '';
    const rating = overallRaw ? safeInt(overallRaw) : Math.round(statAvg);

    const rawCard = row['Version'] ?? row['Card'] ?? row['Type'] ?? '';
    const cardType = detectCardType(rawCard);
    const positions = parsePositions(row['Position'] ?? row['Pos'] ?? '');

    return {
      id:        `fw_${index}_${name.replace(/\s+/g, '_')}`,
      name,
      rating:    Math.min(99, Math.max(1, rating || 70)),
      nation:    (row['Nation'] ?? row['Nationality'] ?? '').trim(),
      league:    (row['League'] ?? '').trim(),
      club:      (row['Club'] ?? row['Team'] ?? '').trim(),
      positions,
      cardType,
      isIcon:    cardType === 'icon',
      isHero:    cardType === 'hero',
      _raw:      row,
    };
  }
}

// ----------------------------------------------------------
// AdapterRegistry — auto-detect and dispatch
// ----------------------------------------------------------

export class AdapterRegistry {
  private adapters: CSVAdapter[];
  private fallback: CSVAdapter;

  constructor(adapters: CSVAdapter[], fallback: CSVAdapter) {
    this.adapters = adapters;
    this.fallback = fallback;
  }

  selectAdapter(headers: string[]): CSVAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(headers)) return adapter;
    }
    return this.fallback;
  }
}

// ----------------------------------------------------------
// Main parse function
// ----------------------------------------------------------

export interface ParseResult {
  players: PlayerCard[];
  skippedRows: number;
  detectedFormat: string;
  warnings: string[];
}

export function parseCSV(filePath: string): ParseResult {
  const warnings: string[] = [];

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  let rows: Record<string, string>[];
  try {
    rows = csvParse(content, {
      columns:           true,
      skip_empty_lines:  true,
      trim:              true,
      relax_quotes:      true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    throw new Error(`Failed to parse CSV: ${(err as Error).message}`);
  }

  if (rows.length === 0) {
    return { players: [], skippedRows: 0, detectedFormat: 'unknown', warnings: ['CSV has no data rows'] };
  }

  const headers = Object.keys(rows[0]);
  const generic = new GenericAdapter();
  const registry = new AdapterRegistry(
    [new CompanionClubExportAdapter(), new ClubAnalyzerAdapter(), new FutwizAdapter()],
    generic,
  );

  const adapter = registry.selectAdapter(headers);
  const formatName = adapter instanceof CompanionClubExportAdapter ? 'Companion / Web App export'
    : adapter instanceof ClubAnalyzerAdapter ? 'Club Analyzer'
    : adapter instanceof FutwizAdapter ? 'FUTWIZ/FUTbin'
    : 'Generic (fuzzy match)';

  const players: PlayerCard[] = [];
  let skipped = 0;

  // Deduplicate: same name + rating + club = same card
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const card = adapter.normalize(rows[i], i);
    if (!card) { skipped++; continue; }

    if (card.positions.length === 0) {
      warnings.push(`Player "${card.name}" has no recognized positions — skipping`);
      skipped++;
      continue;
    }

    if (card.rating < 40 || card.rating > 99) {
      warnings.push(`Player "${card.name}" has suspicious rating ${card.rating} — skipping`);
      skipped++;
      continue;
    }

    const key = `${card.name}|${card.rating}|${card.club}|${card.cardType}`;
    if (seen.has(key)) {
      // Duplicate card — skip for lineup, keep unique cards only
      skipped++;
      continue;
    }
    seen.add(key);
    players.push(card);
  }

  return {
    players,
    skippedRows: skipped,
    detectedFormat: formatName,
    warnings,
  };
}
