// ============================================================
// formations/index.ts — Formation definitions as pure data
// ============================================================

import type { Formation, FormationSlot } from '../types/index.js';

function slot(id: string, accepts: Formation['slots'][number]['accepts'], label?: string): FormationSlot {
  return { id, accepts, label: label ?? id };
}

// ----------------------------------------------------------
// Formation definitions
// Each formation has exactly 11 slots: 1 GK + 10 outfield
// ----------------------------------------------------------

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
};

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
};

const F4231: Formation = {
  name: '4-2-3-1',
  slots: [
    slot('GK',  ['GK']),
    slot('RB',  ['RB', 'RWB']),
    slot('CB1', ['CB'], 'CB'),
    slot('CB2', ['CB'], 'CB'),
    slot('LB',  ['LB', 'LWB']),
    slot('CDM1',['CDM', 'CM'], 'CDM'),
    slot('CDM2',['CDM', 'CM'], 'CDM'),
    slot('RAM', ['CAM', 'RM', 'RW', 'CM']),
    slot('CAM', ['CAM', 'CM']),
    slot('LAM', ['CAM', 'LM', 'LW', 'CM']),
    slot('ST',  ['ST', 'CF']),
  ],
};

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
};

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
};

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
};

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
};

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
};

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
