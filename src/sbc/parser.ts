import type {
  CardProgram,
  CardQuality,
  CardRarity,
  SbcChallenge,
  SbcCountConstraint,
  SbcDistinctConstraint,
  SbcEntityField,
  SbcField,
  SbcSameBucketConstraint,
} from './types.js';

const FIELD_ALIASES: Record<string, SbcField> = {
  nation: 'nation',
  country: 'nation',
  countries: 'nation',
  region: 'nation',
  regions: 'nation',
  league: 'league',
  club: 'club',
  quality: 'quality',
  rarity: 'rarity',
  program: 'program',
};

const ENTITY_LABELS: Record<string, SbcEntityField> = {
  nation: 'nation',
  country: 'nation',
  countries: 'nation',
  'countries/regions': 'nation',
  region: 'nation',
  regions: 'nation',
  league: 'league',
  leagues: 'league',
  club: 'club',
  clubs: 'club',
};

function normalizeFieldToken(raw: string): SbcField | null {
  return FIELD_ALIASES[raw.trim().toLowerCase()] ?? null;
}

function normalizeEntityFieldToken(raw: string): SbcEntityField | null {
  return ENTITY_LABELS[raw.trim().toLowerCase()] ?? null;
}

function normalizeQuality(raw: string): CardQuality {
  const value = raw.trim().toLowerCase();
  if (value === 'bronze' || value === 'silver' || value === 'gold') {
    return value;
  }
  throw new Error(`Unsupported quality value: ${raw}`);
}

function normalizeRarity(raw: string): CardRarity {
  const value = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (value === 'rare' || value === 'non_rare' || value === 'unknown') {
    return value;
  }
  throw new Error(`Unsupported rarity value: ${raw}`);
}

function normalizeProgram(raw: string): CardProgram {
  const value = raw.trim().toLowerCase().replace(/[\s\-]+/g, '_');
  switch (value) {
    case 'icon':
    case 'hero':
    case 'totw':
    case 'toty':
    case 'tots':
    case 'potm':
    case 'fut_birthday':
    case 'special':
      return value;
    default:
      throw new Error(`Unsupported program value: ${raw}`);
  }
}

function canonicalizeValue(field: SbcField, raw: string): string {
  if (field === 'quality') return normalizeQuality(raw);
  if (field === 'rarity') return normalizeRarity(raw);
  if (field === 'program') return normalizeProgram(raw);
  return raw.trim();
}

function splitValues(raw: string): string[] {
  return raw
    .split(/\s+OR\s+|[|/]/i)
    .map(part => part.trim())
    .filter(Boolean);
}

function parseThreshold(rawKind: string, rawValue: string): { min?: number; max?: number; expected: string } {
  const value = parseInt(rawValue, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid threshold: ${rawValue}`);
  }

  const kind = rawKind.trim().toLowerCase();
  if (kind === 'min') {
    return { min: value, expected: `>= ${value}` };
  }
  if (kind === 'max') {
    return { max: value, expected: `<= ${value}` };
  }

  throw new Error(`Unsupported threshold kind: ${rawKind}`);
}

function pushCountConstraint(
  challenge: SbcChallenge,
  field: SbcField,
  values: string[],
  thresholdKind: string,
  thresholdValue: string,
  label: string,
): void {
  const threshold = parseThreshold(thresholdKind, thresholdValue);
  const constraint: SbcCountConstraint = {
    field,
    values: values.map(value => canonicalizeValue(field, value)),
    min: threshold.min,
    max: threshold.max,
    label,
  };
  challenge.countConstraints.push(constraint);
}

function pushSameBucketConstraint(
  challenge: SbcChallenge,
  field: SbcEntityField,
  thresholdKind: string,
  thresholdValue: string,
  label: string,
): void {
  const threshold = parseThreshold(thresholdKind, thresholdValue);
  const constraint: SbcSameBucketConstraint = {
    field,
    min: threshold.min,
    max: threshold.max,
    label,
  };
  challenge.sameBucketConstraints.push(constraint);
}

function pushDistinctConstraint(
  challenge: SbcChallenge,
  field: SbcEntityField,
  thresholdKind: string,
  thresholdValue: string,
  label: string,
): void {
  const threshold = parseThreshold(thresholdKind, thresholdValue);
  const constraint: SbcDistinctConstraint = {
    field,
    min: threshold.min,
    max: threshold.max,
    label,
  };
  challenge.distinctConstraints.push(constraint);
}

function parseLine(challenge: SbcChallenge, rawLine: string): void {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) return;

  let match = line.match(/^Challenge Name:\s*(.+)$/i);
  if (match) {
    challenge.name = match[1].trim();
    return;
  }

  match = line.match(/^Players in Squad:\s*(\d+)$/i);
  if (match) {
    challenge.squadSize = parseInt(match[1], 10);
    return;
  }

  match = line.match(/^Team Rating:\s*Min\.?\s*(\d+)$/i);
  if (match) {
    challenge.minTeamRating = parseInt(match[1], 10);
    return;
  }

  match = line.match(/^Total Chemistry:\s*Min\.?\s*(\d+)$/i);
  if (match) {
    challenge.minChemistry = parseInt(match[1], 10);
    return;
  }

  match = line.match(/^Player Quality:\s*Min\.?\s*(Bronze|Silver|Gold)$/i);
  if (match) {
    challenge.qualityFloor = normalizeQuality(match[1]);
    return;
  }

  match = line.match(/^(Nation|League|Club|Program|Quality|Rarity):\s*(.+?)\s*:\s*(Min|Max)\.?\s*(\d+)\s*Players?$/i);
  if (match) {
    const field = normalizeFieldToken(match[1]);
    if (!field) throw new Error(`Unsupported field: ${match[1]}`);
    pushCountConstraint(challenge, field, splitValues(match[2]), match[3], match[4], line);
    return;
  }

  match = line.match(/^(Gold|Silver|Bronze|Rare|TOTW\/TOTS|TOTW|TOTS):\s*Min\.?\s*(\d+)\s*Players?$/i);
  if (match) {
    const token = match[1].trim().toLowerCase();
    if (token === 'gold' || token === 'silver' || token === 'bronze') {
      pushCountConstraint(challenge, 'quality', [token], 'min', match[2], line);
      return;
    }
    if (token === 'rare') {
      pushCountConstraint(challenge, 'rarity', ['rare'], 'min', match[2], line);
      return;
    }
    if (token === 'totw/tots') {
      pushCountConstraint(challenge, 'program', ['totw', 'tots'], 'min', match[2], line);
      return;
    }
    pushCountConstraint(challenge, 'program', [token], 'min', match[2], line);
    return;
  }

  match = line.match(/^Players from the same (League|Club|Nation|Country|Countries|Countries\/Regions|Region|Regions):\s*(Min|Max)\.?\s*(\d+)$/i);
  if (match) {
    const field = normalizeEntityFieldToken(match[1]);
    if (!field) throw new Error(`Unsupported same-bucket field: ${match[1]}`);
    pushSameBucketConstraint(challenge, field, match[2], match[3], line);
    return;
  }

  match = line.match(/^(Leagues|Clubs|Nations|Countries) in Squad:\s*(Min|Max)\.?\s*(\d+)$/i);
  if (match) {
    const field = normalizeEntityFieldToken(match[1]);
    if (!field) throw new Error(`Unsupported distinct-count field: ${match[1]}`);
    pushDistinctConstraint(challenge, field, match[2], match[3], line);
    return;
  }

  match = line.match(/^(.+?)\s+OR\s+(.+?):\s*(Min|Max)\.?\s*(\d+)\s*Players?$/i);
  if (match) {
    pushCountConstraint(challenge, 'nation', [match[1], match[2]], match[3], match[4], line);
    return;
  }

  throw new Error(`Unsupported SBC requirement line: ${line}`);
}

export function parseSbcRequirements(input: string): SbcChallenge {
  const sourceLines = input
    .split(/\r?\n|;/)
    .map(line => line.trim())
    .filter(Boolean);

  const challenge: SbcChallenge = {
    squadSize: 11,
    countConstraints: [],
    sameBucketConstraints: [],
    distinctConstraints: [],
    sourceLines,
  };

  for (const line of sourceLines) {
    parseLine(challenge, line);
  }

  if (challenge.squadSize !== 11) {
    throw new Error(`Only 11-player SBC squads are supported right now, got ${challenge.squadSize}`);
  }

  return challenge;
}
