# fc-squad-optimizer

A production-quality CLI tool that reads a CSV export of your EA Sports FC club and finds the best possible Starting XI - maximising chemistry, squad strength, and player ratings across all formations simultaneously.

```
  FC OPTIMIZER - BEST STARTING XI
══════════════════════════════════════════════════════════════
  Formation  : 4-2-2-2
  Mode       : balanced
  Chemistry  : [████████████████████] 33/33
  Avg Rating : 91   (Total: 995)
  Strength   : 925.9
```

## Features

- **Multi-formation search** - evaluates 9 built-in formations in parallel and picks the best
- **4 optimization modes** - `max-chem`, `balanced`, `max-rating`, `meta`
- **FC 25 chemistry engine** - models club/league/nation links, Icons, and Heroes accurately
- **Explanation block** - tells you *why* this lineup was chosen
- **Swap suggestions** - e.g. "replace X with Y: +-0 chem, +3 rating"
- **Alternative lineups** - shows the top-N lineups with trade-off deltas
- **Bench suggestions** - fills 7 bench spots by role
- **Configurable scoring weights** - override everything via JSON config
- **Four CSV format adapters** - EA FC Companion/Web App export, Club Analyzer, FUTWIZ/FUTbin, and a generic fuzzy-match fallback
- **JSON output** - pipe-friendly structured output for integrations
- **SBC solver CLI** - solves Squad Building Challenges from structured text requirements
- **Manual ChatGPT prompt** - prints a prompt for screenshot -> requirements extraction without any built-in AI dependency
- **Fast** - typical 300-card club completes in under 1 second

## Installation

```bash
git clone https://github.com/Dimagious/fc-squad-optimizer.git
cd fc-squad-optimizer
npm install
npm run build
```

Or install globally:

```bash
npm install -g .
fc-optimizer --input club.csv
```

## Usage

```bash
# Quickstart - balanced mode, all 9 formations
# Works directly with EA FC Companion / Web App club exports
node dist/cli/index.js --input club.csv

# With bench and top-3 alternatives
node dist/cli/index.js --input club.csv --mode balanced --top 3 --bench

# Force a specific formation
node dist/cli/index.js --input club.csv --formation 4-3-3

# Show per-player chemistry breakdown
node dist/cli/index.js --input club.csv --verbose

# Max chemistry mode
node dist/cli/index.js --input club.csv --mode max-chem

# Highest rated squad, chemistry secondary
node dist/cli/index.js --input club.csv --mode max-rating

# Role-aware meta scoring
node dist/cli/index.js --input club.csv --mode meta --formation 4-2-3-1

# JSON output (pipe-friendly)
node dist/cli/index.js --input club.csv --json | jq '.bestScore'

# Custom scoring weights
node dist/cli/index.js --input club.csv --config config/scoring.config.json

# SBC solver from a requirements file
node dist/cli/sbc.js --input club.csv --requirements-file examples/sbc.requirements.sample.txt

# Print the manual ChatGPT prompt for screenshot extraction
node dist/cli/sbc.js --print-chatgpt-prompt
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-i, --input <path>` | *(required)* | Path to your CSV export |
| `-m, --mode <mode>` | `balanced` | Optimization mode (see below) |
| `-f, --formation <name>` | *(all)* | Force one formation, e.g. `4-3-3` |
| `-t, --top <n>` | `3` | Number of alternative lineups to show |
| `--candidate-limit <n>` | `15` | Max candidates per slot (lower = faster search) |
| `--bench` | off | Show 7 bench suggestions by role |
| `--verbose` | off | Show per-player chemistry link breakdown |
| `--json` | off | Output structured JSON instead of formatted table |
| `--config <path>` | - | JSON file with scoring weight overrides |

## SBC Solver

The repository now ships a separate SBC CLI:

```bash
node dist/cli/sbc.js --input club.csv --requirements-file requirements.txt
```

SBC flags:

| Flag | Description |
|------|-------------|
| `-i, --input <path>` | Path to the club CSV export |
| `-r, --requirements <text>` | Inline requirements text |
| `--requirements-file <path>` | Requirements file generated manually or via ChatGPT |
| `--candidate-pools <sizes>` | Override heuristic pool sizes, e.g. `32,48,64,80` |
| `--json` | Structured JSON output |
| `--print-chatgpt-prompt` | Print the bundled screenshot-extraction prompt |

Supported requirement families:

- field counts: `Nation: Italy OR Northern Ireland: Min 2 Players`
- same-bucket min/max: `Players from the same League: Max 3`
- distinct-count min/max: `Clubs in Squad: Min 6`
- quality floor: `Player Quality: Min Silver`
- quality/rarity/program counts: `Gold: Min 3 Players`, `Rarity: Rare: Min 1 Player`, `Program: TOTW OR TOTS: Min 1 Player`
- global thresholds: `Team Rating: Min 78`, `Total Chemistry: Min 26`

Example:

```bash
node dist/cli/sbc.js \
  --input club.csv \
  --requirements-file examples/sbc.requirements.sample.txt
```

The solver:

- filters the club to cards that can satisfy the quality floor
- evaluates card "keep value" so strong or rare cards are preserved when possible
- searches for a valid 11-player combination under SBC constraints
- reports the submitted cards, achieved rating/chemistry, and a per-constraint check

### Manual ChatGPT Workflow

This project does not send screenshots to any model by itself.

Instead:

1. Print the bundled prompt:

```bash
node dist/cli/sbc.js --print-chatgpt-prompt
```

2. Paste that prompt into ChatGPT and attach the SBC screenshot.
3. Save the returned `requirements.txt` block to a local file.
4. Run:

```bash
node dist/cli/sbc.js --input club.csv --requirements-file requirements.txt
```

See [`examples/sbc.requirements.sample.txt`](examples/sbc.requirements.sample.txt) for the expected format.

## Optimization Modes

| Mode | Primary signal | Use case |
|------|---------------|----------|
| `max-chem` | Chemistry (75% weight) | Ultimate Team chemistry challenges |
| `balanced` | Combined score (chem + strength) | Standard competitive play |
| `max-rating` | Total rating (65% weight) | Highest average OVR squad |
| `meta` | Role-weighted strength (45%) | Gameplay-focused, attackers prioritised |

All modes still track and report all three metrics. The mode only controls the weighting in the ranking score.

## Supported Formations

`4-4-2` · `4-2-2-2` · `4-2-3-1` · `4-3-3` · `4-3-2-1` · `4-1-2-1-2` · `4-5-1` · `3-5-2` · `5-2-1-2`

## CSV Format Support

The parser auto-detects your export format from the header row:

| Format | Detection | Notes |
|--------|-----------|-------|
| **Companion / Web App export** | `Id` + `Lastname` + `Name` + `Rating` + `Position` + `Rarity` | Recommended - primary supported format |
| **Club Analyzer** | `Overall` + `Alt Pos` + `Card Type` columns | Legacy adapter for normalized textual exports |
| **FUTWIZ / FUTbin** | `PAC`, `SHO`, `DRI` stat columns | Individual stats used if OVR missing |
| **Generic** | Fuzzy column matching | Works with most custom exports |

For the primary Companion / Web App export, the parser handles:

- split player names (`Name` + `Lastname`)
- numeric position codes (`0`, `3`, `5`, `7`, `10`, `12`, `14`, `16`, `18`, `23`, `25`, `27`)
- localized rarities such as `Редкий`, `Обычный`, `КУМИР`, `Герой`, `Команда недели (TOTW)`, and `День рождения FUT`
- placeholder rows or non-player entries with invalid positions

Minimum required columns for the generic fallback: `Name` + `Position`. All other columns are optional.

Example (Companion / Web App format):

```csv
Id,Lastname,Name,Rating,Position,Rarity,Country,League,Club
212831,Ramses Becker,Alisson,89,0,Редкий,Brazil,Premier League,Liverpool
50339411,Pirlo,Andrea,91,18,КУМИР Временного разрыва,Italy,Кумиры,КУМИР
202126,Kane,Harry,89,25,Команда недели (TOTW),England,Bundesliga,FC Bayern München
```

Position codes are converted automatically: `0=GK`, `3=RB`, `5=CB`, `7=LB`, `10=CDM`, `12=RM`, `14=CM`, `16=LM`, `18=CAM`, `23=RW`, `25=ST`, `27=LW`.

See [`examples/club.sample.csv`](examples/club.sample.csv) for the legacy Club Analyzer example.

## Example Output

```
════════════════════════════════════════════════════════════════
  FC OPTIMIZER - BEST STARTING XI
════════════════════════════════════════════════════════════════

-- SUMMARY -----------------------------------------------------
  Formation  : 4-2-2-2
  Mode       : balanced
  Chemistry  : [████████████████████] 33/33
  Avg Rating : 91   (Total: 995)
  Strength   : 925.9

-- STARTING XI -------------------------------------------------

  Slot         Player                    Rat  Chem  Nation / League
  GK           Alisson                    90  ●●●   Brazil / Premier League
  RB           Trent                      87  ●●●   England / Premier League
  CB           Van Dijk                   90  ●●●   Netherlands / Premier League
  CB           Virgil2                    89  ●●●   Netherlands / Premier League
  LB           Alaba                      87  ●●●   Austria / La Liga
  CDM          De Bruyne [HERO]           91  ●●●   Belgium / Premier League
  CDM          Bellingham                 91  ●●●   England / La Liga
  CAM          Messi [ICON]               91  ●●●   Argentina / MLS
  CAM          Vinicius Jr                92  ●●●   Brazil / La Liga
  ST           Haaland                    94  ●●●   Norway / Premier League
  ST           Mbappe                     93  ●●●   France / La Liga

-- WHY THIS LINEUP ---------------------------------------------
  Perfect chemistry (33/33) - all players are fully linked
  Icons: Messi - bridging chemistry links across nations/leagues
  Heroes: De Bruyne - providing league-based chemistry boosts

-- SWAP SUGGESTIONS --------------------------------------------
  GK      Alisson     -> Ter Stegen     [+-0 chem, -1 rat]
  CDM2    Bellingham  -> Valverde       [+-0 chem, -4 rat]
  ST1     Haaland     -> Ronaldo        [+-0 chem, -3 rat]
```

Full sample in [`examples/output.sample.txt`](examples/output.sample.txt).

## Custom Scoring Config

Create a JSON file to tune weights without touching source code:

```json
{
  "scoringOverrides": {
    "chemistryWeight": 0.55,
    "strengthWeight": 0.30,
    "ratingWeight": 0.15,
    "iconBonus": 4.0,
    "heroBonus": 3.0,
    "specialCardBonus": 2.0,
    "positionWeights": {
      "ST": 1.10,
      "CAM": 1.05,
      "GK": 0.90
    }
  },
  "candidateLimit": 12,
  "formations": ["4-3-3", "4-2-3-1", "4-4-2"]
}
```

Then run:

```bash
node dist/cli/index.js --input club.csv --config config/scoring.config.json
```

See [`config/scoring.config.json`](config/scoring.config.json) for the shipped example.

## How It Works

### 1. CSV Parsing

The parser uses an adapter registry: it inspects the CSV header row and dispatches to the most specific adapter (Club Analyzer > FUTWIZ > Generic fuzzy). Each adapter normalises rows into a typed `PlayerCard` with positions, rating, nation, league, club, and card type.

### 2. Player Normalisation

- Card types are detected from the raw string (`TOTY`, `Icon`, `Hero`, `TOTS`, etc.)
- Positions are parsed from both the primary and alt-position columns
- Duplicate cards (same name + rating + club + card type) are deduplicated
- Players with no recognisable positions or out-of-range ratings are skipped with a warning

### 3. Formation System

Nine formations are defined as pure data (`FormationSlot[]`). Each slot specifies which position codes it accepts - for example, the CDM slot accepts `['CDM', 'CM']`. This allows flexible assignment without separate position-conversion logic.

### 4. Chemistry Engine (FC 25 model)

Individual chemistry (0-3) is computed per player based on connection points with teammates:

| Link type | Points |
|-----------|--------|
| Club link | 3 pts  |
| League link | 2 pts |
| Nation link | 2 pts |

Thresholds: >=6 pts -> 3 chem, >=3 pts -> 2 chem, >=1 pt -> 1 chem.

**Icons** always receive 3 individual chemistry and act as universal bridges (they count as a nation + league link for every teammate). **Heroes** always receive 3 individual chemistry and provide league/nation bridges to matching teammates.

Squad chemistry = sum of all 11 individual chemistries (max 33).

> Note: This implementation uses a "full squad" neighbour model. Real EA FC uses formation-specific adjacency graphs. This slightly overestimates chemistry for flank players but is a good practical approximation. The engine is behind a `ChemistryEngine` interface so it can be replaced per FC season.

### 5. Optimizer (Backtracking + Branch-and-Bound)

For each formation:

1. Eligible players per slot are pre-computed and sorted by rating (top-N candidates)
2. Slots are searched in **constraint order** - fewest candidates first, maximising early pruning
3. At each branch, an **optimistic upper bound** is computed: current rating + best remaining. If this can't beat the known-worst entry in the top-N, the branch is pruned
4. A **hard cap of 50,000 iterations per formation** prevents runaway on very large clubs

All formations are searched in sequence; results are merged into a single ranked list.

### 6. Scoring System

Each completed lineup is scored as:

```
finalScore = chemistryWeight x (chemistry/33)
           + strengthWeight  x (strengthScore / maxPossible)
           + ratingWeight    x (totalRating / maxPossible)
```

Strength score = sum of `(rating + cardBonus) x positionWeight` for each assignment. Mode presets set the weights; `--config` lets you override them at runtime.

### 7. Explanation + Swap Analysis

After finding the best lineup, the explainer:
- Summarises why the lineup won (chemistry, icons/heroes, formation comparison)
- Generates swap suggestions by testing each slot's best alternative and computing the chemistry and rating deltas
- Fills a 7-player bench by role (1 GK, 2 DEF, 2 MID, 2 ATT)

## Architecture

```
src/
├── types/index.ts        - All TypeScript interfaces (PlayerCard, Formation, Lineup, ...)
├── formations/index.ts   - 9 formations as pure data (no logic)
├── chemistry/fc25.ts     - FC 25 chemistry engine (implements ChemistryEngine interface)
├── scorer/index.ts       - Configurable scoring presets per mode
├── adapters/index.ts     - CSV parsing pipeline with adapter registry
├── sbc/
│   ├── parser.ts         - SBC requirements text parser
│   ├── prompt.ts         - manual ChatGPT prompt for screenshot extraction
│   ├── rating.ts         - SBC squad rating formula
│   ├── solver.ts         - SBC search and card-preservation heuristics
│   └── types.ts          - SBC domain types
├── optimizer/index.ts    - Backtracking search with branch-and-bound pruning
├── explainer/index.ts    - Explanation, swap suggestions, bench analysis
└── cli/
    ├── index.ts          - Commander CLI entrypoint
    ├── sbc.ts            - SBC CLI entrypoint
    └── printer.ts        - Chalk terminal renderer + JSON output
```

The core modules (`chemistry`, `scorer`, `optimizer`, `explainer`) have **no dependency on Node.js I/O** - they operate entirely on plain TypeScript types. This makes it easy to wrap them in a web API, Discord bot, or serverless function.

## Running Tests

```bash
npm test
```

78 tests across 9 suites, all deterministic:

| Suite | Tests | Coverage |
|-------|-------|---------|
| `chemistry.test.ts` | 17 | FC 25 chemistry edge cases and adjacency behavior |
| `chemistry-fc26.test.ts` | 15 | FC 26 chemistry thresholds, heroes, icons, and manager bonus |
| `optimizer.test.ts` | 13 | Valid lineups, bronze/silver filtering, chemistry-aware ordering |
| `optimizer-pool.test.ts` | 11 | Pool frequency analysis and connectivity heuristics |
| `scorer.test.ts` | 4 | Total rating, mode ordering, compare scores, preset weight sums |
| `adapters.test.ts` | 3 | Companion export parsing and localized card types |
| `sbc-parser.test.ts` | 2 | Canonical and screenshot-style SBC requirement parsing |
| `sbc-rating.test.ts` | 3 | SBC squad rating formula and padding behavior |
| `sbc-solver.test.ts` | 1 | End-to-end SBC solve flow on a themed challenge |

## Known Limitations

- **Adjacency model**: Full pitch-layout adjacency (which exact pairs count as linked) is approximated with a "all teammates are neighbours" model. This slightly overestimates chemistry for wide/flank players.
- **Position modifiers**: EA FC 25 allows some cards to be moved to adjacent positions at a chemistry penalty. Only explicit positions on the card are considered here.
- **Attribute boosts**: The per-point in-game stat boost from chemistry is not modelled - we optimise for the chemistry score itself.
- **Season accuracy**: Chemistry rules change per FC edition. The engine is isolated behind a `ChemistryEngine` interface so a new season's rules can be implemented without touching the rest of the codebase.

## Roadmap

- [ ] Formation-specific adjacency graphs for precise chemistry
- [ ] Position modifier support (e.g. ST->CF at -1 chem)
- [ ] Web UI wrapper
- [ ] Discord bot integration
- [ ] Import from EA FC API directly (no CSV needed)
- [ ] FC 26 chemistry engine

## Contributing

Contributions are welcome. Open an issue to discuss significant changes first.

```bash
npm run build   # compile TypeScript
npm test        # run all tests
npm run lint    # ESLint check
```

## License

[MIT](LICENSE) - Dmitriy Yurkin

---

> **Support**: If this tool saved you time building squads, consider [buying me a coffee](https://buymeacoffee.com/dimagious) ☕
