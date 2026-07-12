import { Material, ModEffect, PartCost, ShipModLevel, ShipModLevelRaw } from './ship-mod';

/**
 * Parses the free-text effect/parts fields in ship-mod-levels.json into structured
 * data. The source text has a handful of known irregularities (see KNOWN_TEXT_FIXES
 * and the conjunction-list handling below) confirmed by scanning all 750 rows —
 * see data/ship-mods-notes.md and the Phase 1 data-normalization note in the project
 * plan. Any row that doesn't fit these patterns is reported by validateParsing()
 * rather than silently mis-parsed.
 */

const MATERIAL_CANONICAL: Record<string, Material> = {
  Nanotube: 'Nanotubes',
  Nanotubes: 'Nanotubes',
  Superalloy: 'Superalloys',
  Superalloys: 'Superalloys',
  Aerogel: 'Aerogels',
  Aerogels: 'Aerogels',
  Metamaterial: 'Metamaterials',
  Metamaterials: 'Metamaterials',
  Amorphite: 'Amorphites',
  Amorphites: 'Amorphites',
};

/** One-off text quirks in the source data, fixed before generic parsing. */
const KNOWN_TEXT_FIXES: [RegExp, string][] = [
  // sensor_overclock: stray comma splits one stat name ("sensor jam strength") in two.
  [/sensor,\s*jam strength/gi, 'sensor jam strength'],
];

// Stats that share a delta across a conjunction list, e.g. "hull thermal and kinetic
// resistance" -> "hull thermal resistance" + "hull kinetic resistance". Confirmed to
// cover every "and"-list across all 50 mods x 2 endpoint levels (resistance/damage/capacity).
const CONJUNCTION_RE =
  /^(?:(hull|shield|engine|sensor|shipsim|capacitor)\s+)?([a-zA-Z]+(?:,\s*[a-zA-Z]+)*(?:,)?\s+and\s+[a-zA-Z]+)\s+(resistance|damage|capacity)$/;

export function parsePartsCost(text: string): PartCost[] {
  const matches = text.matchAll(/(\d+)\s+([A-Za-z]+)/g);
  const parts: PartCost[] = [];
  for (const m of matches) {
    const material = MATERIAL_CANONICAL[m[2]];
    if (!material) {
      throw new Error(`Unknown material "${m[2]}" in parts cost text: "${text}"`);
    }
    parts.push({ material, qty: Number(m[1]) });
  }
  return parts;
}

function splitEffectSegments(text: string): { delta: number; description: string }[] {
  const fixed = KNOWN_TEXT_FIXES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
  const matches = [...fixed.matchAll(/([+-]?)(\d+(?:\.\d+)?)%\s*/g)];
  return matches.map((m, i) => {
    const sign = m[1] === '-' ? -1 : 1;
    const delta = sign * Number(m[2]);
    const descStart = (m.index ?? 0) + m[0].length;
    const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? fixed.length) : fixed.length;
    const description = fixed
      .slice(descStart, nextStart)
      .replace(/,\s*$/, '')
      .trim();
    return { delta, description };
  });
}

function canonicalizeStats(rawDescription: string): string[] {
  let desc = rawDescription.replace(/\s+/g, ' ').trim();
  if (/^to\s+/i.test(desc)) {
    desc = desc.replace(/^to\s+/i, '');
  }
  const match = desc.match(CONJUNCTION_RE);
  if (match) {
    const [, prefix, list, suffix] = match;
    // Try ", and " (Oxford comma + and) as one delimiter first, so a 3+ item list like
    // "thermal, gravitic, and kinetic" doesn't leave a stray "and " stuck to the last item.
    const elements = list
      .split(/,\s*and\s+|,\s*|\s+and\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return elements.map((el) => [prefix, el, suffix].filter(Boolean).join(' '));
  }
  return [desc];
}

export function parseEffectText(text: string): ModEffect[] {
  const segments = splitEffectSegments(text);
  const effects: ModEffect[] = [];
  for (const { delta, description } of segments) {
    if (!description) {
      throw new Error(`Empty stat description in effect text: "${text}"`);
    }
    for (const stat of canonicalizeStats(description)) {
      effects.push({ stat, delta_pct: delta });
    }
  }
  return effects;
}

export function parseShipModLevel(raw: ShipModLevelRaw): ShipModLevel {
  return {
    shortname: raw.shortname,
    full_name: raw.full_name,
    level: raw.level,
    parts: parsePartsCost(raw.parts_interceptor_base_cost),
    effects: parseEffectText(raw.effect),
  };
}

export interface ParsingIssue {
  shortname: string;
  level: number;
  field: 'effect' | 'parts';
  raw: string;
  error: string;
}

/** Parses every row and reports any that failed, instead of throwing — used to drive manual spot-checks. */
export function validateParsing(rows: ShipModLevelRaw[]): { parsed: ShipModLevel[]; issues: ParsingIssue[] } {
  const parsed: ShipModLevel[] = [];
  const issues: ParsingIssue[] = [];
  for (const row of rows) {
    try {
      parsed.push(parseShipModLevel(row));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const field = error.includes('material') ? 'parts' : 'effect';
      issues.push({ shortname: row.shortname, level: row.level, field, raw: row.effect, error });
    }
  }
  return { parsed, issues };
}
