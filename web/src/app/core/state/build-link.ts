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

/** Trailing marker on a module id in `m=` meaning "fitted but switched off" — see BuildStore.moduleActive. */
const INACTIVE_SUFFIX = 'x';

/** Encodes the current build into a query string (no leading `?`) for the share link. */
export function encodeBuild(build: BuildStore, data: DataService): string {
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
  const active = build.moduleActive();
  // The inactive flag rides along on the module id itself (e.g. `4x`) rather than a
  // separate index-list param — one shorter token beats a whole extra `key=` pair.
  if (modules.length) {
    parts.push(`m=${modules.map((m, i) => `${m.id}${active[i] ?? true ? '' : INACTIVE_SUFFIX}`).join(',')}`);
  }

  const boostLinks = build.damageBoostLinks();
  if (boostLinks.some((id) => id != null)) parts.push(`bl=${boostLinks.map((id) => id ?? '').join(',')}`);

  // Mods are keyed by shortname everywhere else in the app (mod-capacity.ts, BuildStore),
  // but shortnames run 10-20+ chars each — too long to repeat in a URL. The catalog's own
  // array position is a much shorter stand-in, valid as long as it's decoded against the
  // same data snapshot it was encoded from (same tradeoff hull/component/module ids
  // already make — see applySharedBuildFromUrl's header comment).
  const shipMods = data.shipMods();
  const modIndex = new Map(shipMods.map((m, i) => [m.shortname, i]));
  const mods = build.mods().filter((m) => modIndex.has(m.shortname));
  if (mods.length) parts.push(`mo=${mods.map((m) => `${modIndex.get(m.shortname)}:${m.level}`).join(',')}`);

  return parts.join('&');
}

/** Builds the full shareable URL for the current build (page's own origin/path + encoded query). */
export function buildShareUrl(build: BuildStore, data: DataService): string {
  const query = encodeBuild(build, data);
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

  /** Each token is a module id, optionally suffixed with `x` for "fitted but inactive" — see encodeBuild. */
  const moduleTokens = (params.get('m') ?? '').split(',').filter(Boolean);
  for (const token of moduleTokens) {
    const inactive = token.endsWith(INACTIVE_SUFFIX);
    const moduleId = Number(inactive ? token.slice(0, -INACTIVE_SUFFIX.length) : token);
    if (!Number.isInteger(moduleId)) continue;
    const module = data.modules().find((m) => m.id === moduleId);
    if (!module) continue;
    build.addModule(module);
    if (inactive) build.setModuleActive(build.modules().length - 1, false);
  }

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

  /** Each token is `<catalog index>:<level>` — see encodeBuild's comment on why mods use an index, not their shortname. */
  const shipMods = data.shipMods();
  const modTokens = (params.get('mo') ?? '').split(',').filter(Boolean);
  for (const token of modTokens) {
    const [indexStr, levelStr] = token.split(':');
    const index = Number(indexStr);
    const level = Number(levelStr);
    if (!Number.isInteger(index) || !Number.isInteger(level) || level < 1 || level > 15) continue;
    const shortname = shipMods[index]?.shortname;
    if (!shortname) continue;
    build.addMod(shortname);
    build.setModLevel(shortname, level);
  }

  return true;
}
