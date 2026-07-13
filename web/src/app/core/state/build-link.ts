import { ComponentType } from '../models/component';
import { DataService } from '../data/data.service';
import { BuildStore } from './build.store';

/**
 * Plain query params rather than a single base64(JSON) blob — a JSON envelope's
 * quoted keys/braces plus base64's ~33% inflation made links noticeably longer
 * for no real benefit (params are just as easy to validate on decode, and stay
 * human-inspectable in the URL bar). Commas/colons are left unescaped in the
 * values below since only `&`, `=`, `#`, `%`, and spaces actually need escaping
 * in a query value — none of our ids/shortnames ever contain those.
 */
const COMPONENT_PARAM: Record<ComponentType, string> = {
  Capacitor: 'c',
  Engine: 'e',
  Shield: 's',
  Shipsim: 'ss',
  Sensor: 'sn',
};

/** Encodes the current build into a query string (no leading `?`) for the share link. */
export function encodeBuild(build: BuildStore): string {
  const hull = build.hull();
  if (!hull) return '';

  const parts = [`h=${hull.id}`];
  const components: [ComponentType, { id: number } | null][] = [
    ['Capacitor', build.capacitor()],
    ['Engine', build.engine()],
    ['Shield', build.shield()],
    ['Shipsim', build.shipsim()],
    ['Sensor', build.sensor()],
  ];
  for (const [type, component] of components) {
    if (component) parts.push(`${COMPONENT_PARAM[type]}=${component.id}`);
  }

  const modules = build.modules();
  if (modules.length) parts.push(`m=${modules.map((m) => m.id).join(',')}`);

  const active = build.moduleActive();
  const inactiveIndices = active.flatMap((isActive, i) => (isActive ? [] : [i]));
  if (inactiveIndices.length) parts.push(`ia=${inactiveIndices.join(',')}`);

  const boostLinks = build.damageBoostLinks();
  if (boostLinks.some((id) => id != null)) parts.push(`bl=${boostLinks.map((id) => id ?? '').join(',')}`);

  const mods = build.mods();
  if (mods.length) parts.push(`mo=${mods.map((m) => `${m.shortname}:${m.level}`).join(',')}`);

  return parts.join('&');
}

/** Builds the full shareable URL for the current build (page's own origin/path + encoded query). */
export function buildShareUrl(build: BuildStore): string {
  const query = encodeBuild(build);
  const base = `${location.origin}${location.pathname}`;
  return query ? `${base}?${query}` : base;
}

export function hasSharedBuildInUrl(): boolean {
  return new URLSearchParams(location.search).has('h');
}

/**
 * Applies a shared build from the URL's query params, looking up each id against the
 * loaded data catalog. Unknown/invalid ids are skipped rather than thrown — a share
 * link should degrade gracefully (e.g. after a data snapshot update renumbers
 * something) instead of leaving the app in a broken state.
 */
export function applySharedBuildFromUrl(build: BuildStore, data: DataService): boolean {
  const params = new URLSearchParams(location.search);
  const hullId = Number(params.get('h'));
  if (!Number.isInteger(hullId)) return false;

  const hull = data.shipModels().find((m) => m.id === hullId);
  if (!hull) return false;
  build.setHull(hull);

  const findComponent = (type: ComponentType) => {
    const idStr = params.get(COMPONENT_PARAM[type]);
    if (idStr == null) return null;
    const id = Number(idStr);
    return Number.isInteger(id) ? (data.componentsByType(type).find((c) => c.id === id) ?? null) : null;
  };

  const capacitor = findComponent('Capacitor');
  if (capacitor) build.capacitor.set(capacitor);
  const engine = findComponent('Engine');
  if (engine) build.engine.set(engine);
  const shield = findComponent('Shield');
  if (shield) build.shield.set(shield);
  const shipsim = findComponent('Shipsim');
  if (shipsim) build.shipsim.set(shipsim);
  const sensor = findComponent('Sensor');
  if (sensor) build.sensor.set(sensor);

  const moduleIds = (params.get('m') ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger);
  for (const moduleId of moduleIds) {
    const module = data.modules().find((m) => m.id === moduleId);
    if (module) build.addModule(module);
  }

  /** Indices (into the just-fitted `modules`/`moduleActive`) to switch off — see encodeBuild's `ia`. */
  const inactiveIndices = (params.get('ia') ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger);
  for (const index of inactiveIndices) build.setModuleActive(index, false);

  /**
   * One token per fitted Damage Boost module (same order as `damageBoostLinks`,
   * reconstructed above by the `addModule` calls) — empty token means unlinked. A
   * weapon type can be claimed by as many tokens as it has fitted instances (each
   * physical weapon takes at most one link, but e.g. 2 fitted Cannon Is can each
   * hold their own) — a hand-edited or stale link beyond that count, or naming a
   * weapon id not fitted at all, degrades to unlinked instead of double-applying.
   */
  const fittedWeaponCounts = new Map<number, number>();
  for (const m of build.modules()) {
    if (m.weapon_module === 'Yes') fittedWeaponCounts.set(m.id, (fittedWeaponCounts.get(m.id) ?? 0) + 1);
  }
  const claimedWeaponCounts = new Map<number, number>();
  const boostLinkTokens = (params.get('bl') ?? '').split(',');
  boostLinkTokens.forEach((token, index) => {
    if (!token) return;
    const weaponId = Number(token);
    if (!Number.isInteger(weaponId)) return;
    const claimed = claimedWeaponCounts.get(weaponId) ?? 0;
    if (claimed >= (fittedWeaponCounts.get(weaponId) ?? 0)) return;
    claimedWeaponCounts.set(weaponId, claimed + 1);
    build.setDamageBoostLink(index, weaponId);
  });

  const knownShortnames = new Set(data.shipMods().map((m) => m.shortname));
  const modTokens = (params.get('mo') ?? '').split(',').filter(Boolean);
  for (const token of modTokens) {
    const [shortname, levelStr] = token.split(':');
    const level = Number(levelStr);
    if (!shortname || !knownShortnames.has(shortname) || !Number.isInteger(level) || level < 1 || level > 15) continue;
    build.addMod(shortname);
    build.setModLevel(shortname, level);
  }

  return true;
}
