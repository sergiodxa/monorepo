/**
 * The time zones a picker offers and a validator accepts, read from the runtime's own IANA
 * database through `Intl.supportedValuesOf("timeZone")`, so the list always matches what
 * `Intl.DateTimeFormat` accepts on that runtime, plus the zone the runtime's clock runs in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TimeZone } from "./types.js";

/**
 * The zone every list leads with. Some runtimes, Cloudflare Workers among them, leave it
 * out of `Intl.supportedValuesOf("timeZone")`, so it is added by name.
 */
const UTC = "UTC";

/** One IANA area's zones, as a picker renders them: a group label plus its members. */
export interface TimeZoneGroup {
	/** The IANA area prefix, e.g. `"Europe"`. */
	region: string;
	zones: readonly TimeZone[];
}

/** The computed lists, kept for every later call in the same isolate. */
interface TimeZoneCatalog {
	zones: readonly TimeZone[];
	lookup: ReadonlySet<string>;
	groups: readonly TimeZoneGroup[];
}

/**
 * Filled on first use, so importing this module does no work at load time: a Worker's
 * global scope runs during upload validation, where real work fails the upload.
 */
let catalog: TimeZoneCatalog | undefined;

/**
 * Groups zones by the area prefix before their first `/`, in first-seen order. A zone
 * without a prefix, like `"UTC"`, belongs to no area and sits outside every group.
 *
 * @param zones - Zones to group.
 * @returns One group per area.
 */
function groupByArea(zones: readonly TimeZone[]): TimeZoneGroup[] {
	let groups = new Map<string, TimeZone[]>();

	for (let zone of zones) {
		let separator = zone.indexOf("/");
		if (separator === -1) continue;
		let region = zone.slice(0, separator);
		let members = groups.get(region);
		if (members) members.push(zone);
		else groups.set(region, [zone]);
	}

	return [...groups].map(([region, members]) => ({ region, zones: members }));
}

/**
 * Builds the catalog once per isolate. Membership follows the host's ICU build, so two
 * runtimes can disagree; within one runtime the list, the check and the groups agree.
 *
 * @returns The zones, their lookup set, and their area groups.
 */
function load(): TimeZoneCatalog {
	if (catalog) return catalog;

	let zones = [UTC, ...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== UTC)];
	catalog = { zones, lookup: new Set(zones), groups: groupByArea(zones) };
	return catalog;
}

/**
 * Every zone the runtime's IANA database lists, `"UTC"` first and each zone once. Aliases
 * such as `"Etc/UTC"` are absent, so a value picked from this list has one spelling.
 *
 * @returns The zones in the order a picker offers them.
 *
 * @example
 * supportedTimeZones()[0]; // "UTC"
 */
export function supportedTimeZones(): readonly TimeZone[] {
	return load().zones;
}

/**
 * Whether a value is one of `supportedTimeZones()`, the check a form or API field holds a
 * submitted zone to. Aliases `Intl` would also accept fail it, keeping stored values in one
 * spelling; use `isValidTimeZone` to accept any name `Intl` takes.
 *
 * @param value - Candidate zone name, usually untrusted input.
 * @returns `true` when the value is in the list.
 *
 * @example
 * isSupportedTimeZone("Europe/Madrid"); // true
 * @example
 * isSupportedTimeZone("Etc/UTC"); // false
 */
export function isSupportedTimeZone(value: string): boolean {
	return load().lookup.has(value);
}

/**
 * The supported zones grouped by IANA area, so a 400-entry picker reads as a dozen
 * `<optgroup>`s. `"UTC"` has no area and appears in no group, so a picker lists it above.
 *
 * @returns One group per area, in the order the areas first appear.
 *
 * @example
 * timeZonesByRegion().find((group) => group.region === "Europe")?.zones;
 */
export function timeZonesByRegion(): readonly TimeZoneGroup[] {
	return load().groups;
}

/**
 * The zone the runtime's clock runs in: the browser's setting on a page, usually `"UTC"`
 * on a server. Pass it where a calculation should follow the device's own calendar.
 *
 * @returns The IANA zone `Intl` resolves by default.
 *
 * @example
 * toDayKey(new Date(), systemTimeZone());
 */
export function systemTimeZone(): TimeZone {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
