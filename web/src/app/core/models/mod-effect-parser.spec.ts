import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEffectText, parsePartsCost, validateParsing } from './mod-effect-parser';
import { ShipModLevelRaw } from './ship-mod';

// data/ (repo root) is the single source of truth for game data — read it directly
// rather than depending on the public/data/ sync step having run before tests.
// Resolved from process.cwd() (the web/ project root the test runner starts in)
// rather than import.meta.url, which isn't a real file:// URL under the test builder.
function loadShipModLevels(): ShipModLevelRaw[] {
  const path = resolve(process.cwd(), '../data/ship-mod-levels.json');
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('parseEffectText', () => {
  it('parses a simple two-stat effect', () => {
    expect(parseEffectText('+5.25% capacitor hit points, +1.75% capacitor mass')).toEqual([
      { stat: 'capacitor hit points', delta_pct: 5.25 },
      { stat: 'capacitor mass', delta_pct: 1.75 },
    ]);
  });

  it('defaults a missing leading sign to positive (expanded_hardpoints quirk)', () => {
    expect(parseEffectText('1.75% module capacity replaced as hardpoint capacity')).toEqual([
      { stat: 'module capacity replaced as hardpoint capacity', delta_pct: 1.75 },
    ]);
  });

  it('fixes the sensor_overclock stray-comma stat name', () => {
    expect(parseEffectText('+2.10% sensor, jam strength, +0.70% sensor halon cost')).toEqual([
      { stat: 'sensor jam strength', delta_pct: 2.1 },
      { stat: 'sensor halon cost', delta_pct: 0.7 },
    ]);
  });

  it('splits a 2-item conjunction list with a shared prefix', () => {
    expect(parseEffectText('-0.70% hull thermal and kinetic resistance')).toEqual([
      { stat: 'hull thermal resistance', delta_pct: -0.7 },
      { stat: 'hull kinetic resistance', delta_pct: -0.7 },
    ]);
  });

  it('splits a 3-item Oxford-comma conjunction list with no prefix', () => {
    expect(parseEffectText('-0.70% thermal, gravitic, and kinetic damage')).toEqual([
      { stat: 'thermal damage', delta_pct: -0.7 },
      { stat: 'gravitic damage', delta_pct: -0.7 },
      { stat: 'kinetic damage', delta_pct: -0.7 },
    ]);
  });

  it('strips a leading "to" from the stat name', () => {
    expect(parseEffectText('+1.40% to hull hit points')).toEqual([{ stat: 'hull hit points', delta_pct: 1.4 }]);
  });
});

describe('parsePartsCost', () => {
  it('parses a single-material cost', () => {
    expect(parsePartsCost('10 Aerogels.')).toEqual([{ material: 'Aerogels', qty: 10 }]);
  });

  it('parses a two-material cost', () => {
    expect(parsePartsCost('2 Superalloys and 8 Nanotubes.')).toEqual([
      { material: 'Superalloys', qty: 2 },
      { material: 'Nanotubes', qty: 8 },
    ]);
  });

  it('parses a three-material Oxford-comma cost', () => {
    expect(parsePartsCost('3 Aerogels, 3 Amorphites, and 5 Metamaterials.')).toEqual([
      { material: 'Aerogels', qty: 3 },
      { material: 'Amorphites', qty: 3 },
      { material: 'Metamaterials', qty: 5 },
    ]);
  });

  it('canonicalizes singular material names (qty 1)', () => {
    expect(parsePartsCost('1 Nanotube.')).toEqual([{ material: 'Nanotubes', qty: 1 }]);
  });
});

describe('the full ship-mod-levels.json dataset', () => {
  const rows = loadShipModLevels();

  it('has the expected row count', () => {
    expect(rows.length).toBe(750);
  });

  it('parses every row with no issues', () => {
    const { parsed, issues } = validateParsing(rows);
    expect(issues).toEqual([]);
    expect(parsed.length).toBe(rows.length);
  });

  it('produces the same set of canonical stat names across all 15 levels of a given mod', () => {
    const { parsed } = validateParsing(rows);
    const statSetsByMod = new Map<string, Set<string>>();
    for (const row of parsed) {
      const key = [...row.effects.map((e) => e.stat)].sort().join('|');
      if (!statSetsByMod.has(row.shortname)) statSetsByMod.set(row.shortname, new Set());
      statSetsByMod.get(row.shortname)!.add(key);
    }
    const inconsistent = [...statSetsByMod.entries()].filter(([, sets]) => sets.size > 1);
    expect(inconsistent).toEqual([]);
  });
});
