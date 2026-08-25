/**
 * The set of time zones a cron job may be scheduled in, and the grouping the
 * pickers render it with. The zones come from the runtime's own IANA database
 * through `Intl.supportedValuesOf("timeZone")`, so the list can never drift
 * from what `Intl.DateTimeFormat` will actually accept when the scheduler
 * computes the next run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The zone a cron job falls back to, matching the database column, the
 * validator, and every stored row — kept as a literal because the Workers
 * runtime's `Intl.supportedValuesOf("timeZone")` omits `"UTC"` outright.
 */
export const DEFAULT_TIMEZONE = "UTC";

/**
 * Zones and their lookup set, computed once per isolate on first use — a
 * Worker's global scope runs during upload validation, where doing real work
 * fails the dry run. The first request computes it; later ones read the cache.
 */
let cache: { zones: readonly string[]; lookup: ReadonlySet<string> } | undefined;

/**
 * The exact zone membership follows the host's ICU build, so Workers and
 * test runtimes can differ. That's fine here: the picker and validator both
 * read this one function, so within any single runtime they always agree.
 */
function load() {
	if (cache) return cache;

	let zones = [
		DEFAULT_TIMEZONE,
		...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== DEFAULT_TIMEZONE),
	];

	cache = { zones, lookup: new Set(zones) };
	return cache;
}

/**
 * Rejection message for a `timezone` the runtime's IANA database doesn't
 * know, shared by the form and API schemas for one consistent wording that
 * the API client reads verbatim in a `VALIDATION_ERROR` body.
 */
export const UNKNOWN_TIMEZONE_MESSAGE = "Expected a valid IANA time zone";

/** Every acceptable `timezone` value: {@link DEFAULT_TIMEZONE} first, then the IANA zones. */
export function supportedTimezones(): readonly string[] {
	return load().zones;
}

/** Whether `value` is one of {@link supportedTimezones}, the check both the form and the API validate with. */
export function isSupportedTimezone(value: string): boolean {
	return load().lookup.has(value);
}

/** One region's zones, as the picker renders them: an `<optgroup>` label plus its members. */
export interface TimezoneGroup {
	/** The IANA area prefix, e.g. `"Europe"`. */
	region: string;
	zones: readonly string[];
}

/**
 * The IANA zones grouped by their area prefix, so a 400-plus-entry picker reads as a
 * dozen regions instead of one undifferentiated run. {@link DEFAULT_TIMEZONE} is left
 * out: it has no area prefix and belongs above the groups, not inside one.
 */
export function groupedTimezones(): readonly TimezoneGroup[] {
	let groups = new Map<string, string[]>();

	for (let zone of supportedTimezones()) {
		let separator = zone.indexOf("/");
		if (separator === -1) continue;
		let region = zone.slice(0, separator);
		let members = groups.get(region);
		if (members) members.push(zone);
		else groups.set(region, [zone]);
	}

	return [...groups].map(([region, zones]) => ({ region, zones }));
}
