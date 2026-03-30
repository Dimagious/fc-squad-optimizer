// ============================================================
// formations/index.ts — Formation definitions as pure data
//
// ADJACENCY NOTES
// ---------------
// Each formation carries an adjacency map (slotId → neighbour slotIds).
// This reflects the chemistry link lines visible in the FC 25 squad screen.
//
// Rules used to build every map:
//   1. GK connects to every defender in the back line.
//   2. Full-backs connect to GK, the adjacent CB, and the wide midfielder
//      directly above them.
//   3. CBs connect to GK, adjacent CBs, and the nearest central midfielder.
//   4. Midfielders connect to the midfielder(s) on either side and to the
//      nearest player above and below.
//   5. Wingers / wide players connect to the nearest midfielder and the
//      forward directly next to them.
//   6. Forwards connect to each other and to the midfielder(s) immediately
//      below them.
//   7. All maps are symmetric: if A lists B then B must list A.
//
// Sources: EA FC 25 Chemistry Guide (community-verified, Nov 2024)
//          https://www.ea.com/games/ea-sports-fc/fc-25/news/chemistry
// ============================================================

import type { Formation, FormationSlot } from '../types/index.js';

function slot(id: string, accepts: Formation['slots'][number]['accepts'], label?: string): FormationSlot {
  return { id, accepts, label: label ?? id };
}

// ----------------------------------------------------------
// Formation definitions
// Each formation has exactly 11 slots: 1 GK + 10 outfield
// ----------------------------------------------------------

// ── 4-4-2 ────────────────────────────────────────────────
//
//         ST1   ST2
//   LM  CM2  CM1  RM
//   LB  CB2  CB1  RB
//            GK
//
const F442: Formation = {
  name: '4-4-2',
  slots: [
    slot('GK',  ['GK']),
    slot('RB',  ['RB', 'RWB']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('LB',  ['LB', 'LWB']),
    slot('RM',  ['RM', 'RW', 'CM', 'CAM']),
    slot('CM1', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM2', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('LM',  ['LM', 'LW', 'CM', 'CAM']),
    slot('ST1', ['ST', 'CF'], 'ST'),
    slot('ST2', ['ST', 'CF'], 'ST'),
  ],
  // CB1 = right CB (RB side), CB2 = left CB (LB side)
  // CM1 = right-centre mid, CM2 = left-centre mid
  // ST1 = right striker, ST2 = left striker
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

// ── 4-2-2-2 ──────────────────────────────────────────────
//
//          ST1   ST2
//  CAM2           CAM1
//     CDM2   CDM1
//  LB  CB2   CB1  RB
//            GK
//
// CAM1 accepts RW/RM → right side; CAM2 accepts LM/LW → left side
// CDM1 = right CDM (RB side), CDM2 = left CDM (LB side)
//
const F4222: Formation = {
  name: '4-2-2-2',
  slots: [
    slot('GK',   ['GK']),
    slot('RB',   ['RB', 'RWB']),
    slot('CB1',  ['CB'], 'CB'),
    slot('CB2',  ['CB'], 'CB'),
    slot('LB',   ['LB', 'LWB']),
    slot('CDM1', ['CDM', 'CM'], 'CDM'),
    slot('CDM2', ['CDM', 'CM'], 'CDM'),
    slot('CAM1', ['CAM', 'CM', 'RM', 'RW'], 'CAM'),
    slot('CAM2', ['CAM', 'CM', 'LM', 'LW'], 'CAM'),
    slot('ST1',  ['ST', 'CF'], 'ST'),
    slot('ST2',  ['ST', 'CF'], 'ST'),
  ],
  adjacency: {
    GK:   ['RB', 'CB1', 'CB2', 'LB'],
    RB:   ['GK', 'CB1', 'CDM1'],
    CB1:  ['GK', 'RB', 'CB2', 'CDM1'],
    CB2:  ['GK', 'CB1', 'LB', 'CDM2'],
    LB:   ['GK', 'CB2', 'CDM2'],
    CDM1: ['RB', 'CB1', 'CDM2', 'CAM1'],
    CDM2: ['LB', 'CB2', 'CDM1', 'CAM2'],
    // Each wide CAM connects to its CDM and both strikers
    CAM1: ['CDM1', 'ST1', 'ST2'],
    CAM2: ['CDM2', 'ST1', 'ST2'],
    ST1:  ['CAM1', 'CAM2', 'ST2'],
    ST2:  ['CAM1', 'CAM2', 'ST1'],
  },
};

// ── 4-2-3-1 ──────────────────────────────────────────────
//
//               ST
//  LAM    CAM    RAM
//     CDM2   CDM1
//  LB  CB2   CB1  RB
//             GK
//
// CDM1 = right CDM, CDM2 = left CDM
// RAM = right AM, LAM = left AM
//
const F4231: Formation = {
  name: '4-2-3-1',
  slots: [
    slot('GK',   ['GK']),
    slot('RB',   ['RB', 'RWB']),
    slot('CB1',  ['CB'], 'CB'),
    slot('CB2',  ['CB'], 'CB'),
    slot('LB',   ['LB', 'LWB']),
    slot('CDM1', ['CDM', 'CM'], 'CDM'),
    slot('CDM2', ['CDM', 'CM'], 'CDM'),
    slot('RAM',  ['CAM', 'RM', 'RW', 'CM']),
    slot('CAM',  ['CAM', 'CM']),
    slot('LAM',  ['CAM', 'LM', 'LW', 'CM']),
    slot('ST',   ['ST', 'CF']),
  ],
  adjacency: {
    GK:   ['RB', 'CB1', 'CB2', 'LB'],
    RB:   ['GK', 'CB1', 'CDM1'],
    CB1:  ['GK', 'RB', 'CB2', 'CDM1'],
    CB2:  ['GK', 'CB1', 'LB', 'CDM2'],
    LB:   ['GK', 'CB2', 'CDM2'],
    CDM1: ['RB', 'CB1', 'CDM2', 'RAM'],
    CDM2: ['LB', 'CB2', 'CDM1', 'LAM'],
    // Centre AM is directly above both CDMs, connects to RAM, LAM, and ST
    RAM:  ['CDM1', 'CAM', 'ST'],
    CAM:  ['RAM', 'LAM', 'ST'],
    LAM:  ['CDM2', 'CAM', 'ST'],
    ST:   ['RAM', 'CAM', 'LAM'],
  },
};

// ── 4-3-3 ─────────────────────────────────────────────────
//
//   LW      ST      RW
//      CM3  CM2  CM1
//   LB  CB2  CB1  RB
//            GK
//
// CM1 = right mid, CM2 = centre mid, CM3 = left mid
//
const F433: Formation = {
  name: '4-3-3',
  slots: [
    slot('GK',  ['GK']),
    slot('RB',  ['RB', 'RWB']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('LB',  ['LB', 'LWB']),
    slot('CM1', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM2', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM3', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('RW',  ['RW', 'RM', 'ST', 'CF']),
    slot('ST',  ['ST', 'CF']),
    slot('LW',  ['LW', 'LM', 'ST', 'CF']),
  ],
  adjacency: {
    GK:  ['RB', 'CB1', 'CB2', 'LB'],
    RB:  ['GK', 'CB1', 'CM1'],
    CB1: ['GK', 'RB', 'CB2', 'CM1'],
    CB2: ['GK', 'CB1', 'LB', 'CM3'],
    LB:  ['GK', 'CB2', 'CM3'],
    CM1: ['RB', 'CB1', 'CM2', 'RW'],
    CM2: ['CM1', 'CM3', 'ST'],
    CM3: ['LB', 'CB2', 'CM2', 'LW'],
    RW:  ['CM1', 'ST'],
    ST:  ['RW', 'CM2', 'LW'],
    LW:  ['CM3', 'ST'],
  },
};

// ── 4-3-2-1  (Christmas tree) ─────────────────────────────
//
//               ST
//        RF        LF
//   CM3    CM2    CM1
//   LB  CB2  CB1  RB
//             GK
//
// CM1 = right CDM/CM, CM2 = centre CM, CM3 = left CDM/CM
// RF = right forward, LF = left forward
//
const F4321: Formation = {
  name: '4-3-2-1',
  slots: [
    slot('GK',  ['GK']),
    slot('RB',  ['RB', 'RWB']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('LB',  ['LB', 'LWB']),
    slot('CM1', ['CM', 'CDM'], 'CM'),
    slot('CM2', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM3', ['CM', 'CDM'], 'CM'),
    slot('RF',  ['CAM', 'CM', 'RW', 'RM']),
    slot('LF',  ['CAM', 'CM', 'LW', 'LM']),
    slot('ST',  ['ST', 'CF']),
  ],
  adjacency: {
    GK:  ['RB', 'CB1', 'CB2', 'LB'],
    RB:  ['GK', 'CB1', 'CM1'],
    CB1: ['GK', 'RB', 'CB2', 'CM1'],
    CB2: ['GK', 'CB1', 'LB', 'CM3'],
    LB:  ['GK', 'CB2', 'CM3'],
    CM1: ['RB', 'CB1', 'CM2', 'RF'],
    CM2: ['CM1', 'CM3', 'RF', 'LF'],
    CM3: ['LB', 'CB2', 'CM2', 'LF'],
    RF:  ['CM1', 'CM2', 'LF', 'ST'],
    LF:  ['CM3', 'CM2', 'RF', 'ST'],
    ST:  ['RF', 'LF'],
  },
};

// ── 4-1-2-1-2  (narrow diamond) ──────────────────────────
//
//          ST1   ST2
//              CAM
//       CM1       CM2
//           CDM
//   LB  CB2  CB1  RB
//             GK
//
// CDM = defensive pivot (connects to all 4 defenders and both CMs)
// CM1 = right CM, CM2 = left CM (within the diamond)
//
const F41212: Formation = {
  name: '4-1-2-1-2',
  slots: [
    slot('GK',  ['GK']),
    slot('RB',  ['RB', 'RWB']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('LB',  ['LB', 'LWB']),
    slot('CDM', ['CDM', 'CM']),
    slot('CM1', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM2', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CAM', ['CAM', 'CM']),
    slot('ST1', ['ST', 'CF'], 'ST'),
    slot('ST2', ['ST', 'CF'], 'ST'),
  ],
  // The CDM is the diamond base; it bridges defenders and the wide CMs.
  // Full-backs connect to GK, adjacent CB, and up to CDM since no wide mid exists.
  adjacency: {
    GK:  ['RB', 'CB1', 'CB2', 'LB'],
    RB:  ['GK', 'CB1', 'CDM'],
    CB1: ['GK', 'RB', 'CB2', 'CDM'],
    CB2: ['GK', 'CB1', 'LB', 'CDM'],
    LB:  ['GK', 'CB2', 'CDM'],
    CDM: ['RB', 'CB1', 'CB2', 'LB', 'CM1', 'CM2'],
    CM1: ['CDM', 'CM2', 'CAM'],
    CM2: ['CDM', 'CM1', 'CAM'],
    CAM: ['CM1', 'CM2', 'ST1', 'ST2'],
    ST1: ['CAM', 'ST2'],
    ST2: ['CAM', 'ST1'],
  },
};

// ── 4-5-1 ─────────────────────────────────────────────────
//
//                ST
//  LM  CM3  CM2  CM1  RM
//  LB  CB2  CB1  RB
//           GK
//
// RM = right wide mid, CM1 = right-centre, CM2 = centre,
// CM3 = left-centre, LM = left wide mid
// Only the 3 centre mids directly serve the lone ST.
//
const F451: Formation = {
  name: '4-5-1',
  slots: [
    slot('GK',  ['GK']),
    slot('RB',  ['RB', 'RWB']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('LB',  ['LB', 'LWB']),
    slot('RM',  ['RM', 'RW', 'CM', 'CAM']),
    slot('CM1', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM2', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM3', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('LM',  ['LM', 'LW', 'CM', 'CAM']),
    slot('ST',  ['ST', 'CF']),
  ],
  adjacency: {
    GK:  ['RB', 'CB1', 'CB2', 'LB'],
    RB:  ['GK', 'CB1', 'RM'],
    CB1: ['GK', 'RB', 'CB2', 'CM1'],
    CB2: ['GK', 'CB1', 'LB', 'CM3'],
    LB:  ['GK', 'CB2', 'LM'],
    RM:  ['RB', 'CM1'],
    CM1: ['CB1', 'RM', 'CM2', 'ST'],
    CM2: ['CM1', 'CM3', 'ST'],
    CM3: ['CB2', 'CM2', 'LM', 'ST'],
    LM:  ['LB', 'CM3'],
    ST:  ['CM1', 'CM2', 'CM3'],
  },
};

// ── 3-5-2 ─────────────────────────────────────────────────
//
//            ST1   ST2
//  LM  CM3   CM2   CM1  RM
//  CB3    CB2    CB1
//               GK
//
// CB1 = right CB, CB2 = centre CB, CB3 = left CB
// RM = right wing-back, LM = left wing-back
// CM1 = right-centre mid, CM2 = centre mid, CM3 = left-centre mid
//
const F352: Formation = {
  name: '3-5-2',
  slots: [
    slot('GK',  ['GK']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('CB3', ['CB'], 'CB'),
    slot('RM',  ['RWB', 'RB', 'RM', 'RW']),
    slot('CM1', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM2', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('CM3', ['CM', 'CDM', 'CAM'], 'CM'),
    slot('LM',  ['LWB', 'LB', 'LM', 'LW']),
    slot('ST1', ['ST', 'CF'], 'ST'),
    slot('ST2', ['ST', 'CF'], 'ST'),
  ],
  adjacency: {
    GK:  ['CB1', 'CB2', 'CB3'],
    CB1: ['GK', 'CB2', 'RM', 'CM1'],
    CB2: ['GK', 'CB1', 'CB3', 'CM2'],
    CB3: ['GK', 'CB2', 'LM', 'CM3'],
    RM:  ['CB1', 'CM1', 'ST1'],
    CM1: ['CB1', 'RM', 'CM2', 'ST1'],
    CM2: ['CB2', 'CM1', 'CM3', 'ST1', 'ST2'],
    CM3: ['CB3', 'CM2', 'LM', 'ST2'],
    LM:  ['CB3', 'CM3', 'ST2'],
    ST1: ['RM', 'CM1', 'CM2', 'ST2'],
    ST2: ['CM2', 'CM3', 'LM', 'ST1'],
  },
};

// ── 5-2-1-2 ───────────────────────────────────────────────
//
//            ST1   ST2
//                CAM
//       CM2           CM1
//  LWB  CB3  CB2  CB1  RWB
//               GK
//
// RWB = right wing-back, LWB = left wing-back
// CB1 = right CB, CB2 = centre CB, CB3 = left CB
// CM1 = right CM, CM2 = left CM
//
const F5212: Formation = {
  name: '5-2-1-2',
  slots: [
    slot('GK',  ['GK']),
    slot('RWB', ['RWB', 'RB']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('CB3', ['CB'], 'CB'),
    slot('LWB', ['LWB', 'LB']),
    slot('CM1', ['CM', 'CDM'], 'CM'),
    slot('CM2', ['CM', 'CDM'], 'CM'),
    slot('CAM', ['CAM', 'CM']),
    slot('ST1', ['ST', 'CF'], 'ST'),
    slot('ST2', ['ST', 'CF'], 'ST'),
  ],
  // GK connects to all 5 defenders in the back line.
  // Centre CB (CB2) only links to its two neighbouring CBs — the wide CMs
  // connect through CB1/CB3 and the wing-backs.
  adjacency: {
    GK:  ['RWB', 'CB1', 'CB2', 'CB3', 'LWB'],
    RWB: ['GK', 'CB1', 'CM1'],
    CB1: ['GK', 'RWB', 'CB2', 'CM1'],
    CB2: ['GK', 'CB1', 'CB3'],
    CB3: ['GK', 'CB2', 'LWB', 'CM2'],
    LWB: ['GK', 'CB3', 'CM2'],
    CM1: ['RWB', 'CB1', 'CM2', 'CAM'],
    CM2: ['LWB', 'CB3', 'CM1', 'CAM'],
    CAM: ['CM1', 'CM2', 'ST1', 'ST2'],
    ST1: ['CAM', 'ST2'],
    ST2: ['CAM', 'ST1'],
  },
};

// ----------------------------------------------------------
// Registry
// ----------------------------------------------------------

export const ALL_FORMATIONS: Formation[] = [
  F442, F4222, F4231, F433, F4321, F41212, F451, F352, F5212,
];

export const FORMATION_MAP: Map<string, Formation> = new Map(
  ALL_FORMATIONS.map(f => [f.name, f])
);

export function getFormation(name: string): Formation | undefined {
  return FORMATION_MAP.get(name);
}

export function getFormations(names?: string[]): Formation[] {
  if (!names || names.length === 0) return ALL_FORMATIONS;
  return names
    .map(n => FORMATION_MAP.get(n))
    .filter((f): f is Formation => f !== undefined);
}
