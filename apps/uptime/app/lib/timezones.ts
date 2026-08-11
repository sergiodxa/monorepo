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
 * The zone a cron job falls back to, in the spelling the database column, the
 * validators and every existing row already use.
 *
 * It is listed separately from the IANA enumeration on purpose, and the exception
 * must stay: `Intl.supportedValuesOf("timeZone")` does not return `"UTC"` at all in
 * the Workers runtime — it returns 418 region-prefixed zones and no `Etc/*` entries,
 * so neither `"UTC"` nor its sometimes-canonical alias `Etc/UTC` appears. Meanwhile
 * `"UTC"` is the column default, the validator default, and the value every stored
 * cron job holds. Validating against the enumeration alone would therefore reject
 * the exact value this app documents as the default.
 */
export const DEFAULT_TIMEZONE = "UTC";

/**
 * Zones, and the lookup set over them, computed once per isolate.
 *
 * Deliberately not computed at module scope: a Worker's global scope runs during
 * upload validation, where doing real work is a failure mode a dry run doesn't
 * catch. The first request pays for the enumeration and every later one reads the
 * cache.
 */
let cache: { zones: readonly string[]; lookup: ReadonlySet<string> } | undefined;

function load() {
	if (cache) return cache;

	/*
	 * `Intl.supportedValuesOf` returns a sorted, deduplicated, canonical list, but the
	 * exact membership follows the host's ICU build — the Workers runtime returns 418
	 * zones while the test runtime returns more, including some `Etc/GMT±N` entries.
	 * That is fine because the picker and the validator both read this one function, so
	 * within any single runtime they agree exactly; only a test asserting a zone that
	 * one of the two runtimes lacks would notice.
	 *
	 * `DEFAULT_TIMEZONE` leads the list rather than being sorted into it, so the picker
	 * can offer it above the regional groups, and it is filtered out of the enumeration
	 * first so a runtime that does include it doesn't produce a duplicate option.
	 */
	let zones = [
		DEFAULT_TIMEZONE,
		...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== DEFAULT_TIMEZONE),
	];

	cache = { zones, lookup: new Set(zones) };
	return cache;
}

/**
 * Rejection message for a `timezone` the runtime's IANA database doesn't know.
 *
 * Shared by the form and API schemas so a client sees one wording whichever surface it
 * posts to. The form path never renders it — a failed parse there flashes the action's
 * own generic error toast — so it is written for the API client that reads it verbatim
 * in a `VALIDATION_ERROR` body, like every other message in those schemas.
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
