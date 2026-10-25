/**
 * Accept-Language header parsing and matching. Parses the raw header into
 * priority-sorted language ranges (RFC 9110 §12.5.4) and picks the best supported
 * language with RFC 4647 §3.4 Lookup, or loosely by primary language code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One comma-separated language range of an Accept-Language header, trimmed: the tag (or `*`) and
 * its optional RFC 9110 weight, whose `q` is case-insensitive and whose value is 0 to 1 with at
 * most three decimals. Anchored at both ends, so each range is read once in linear time.
 */
const LANGUAGE_RANGE =
	/^([a-zA-Z]{1,8}(?:-[a-zA-Z0-9]{1,8})*|\*)(?:[ \t]*;[ \t]*[qQ]=(0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?))?$/;

/** A four-letter script subtag, valid only right after the primary language subtag. */
const SCRIPT_SUBTAG = /^[a-zA-Z]{4}$/;

/** A two-letter or three-digit region subtag, following the language or the script. */
const REGION_SUBTAG = /^(?:[a-zA-Z]{2}|[0-9]{3})$/;

/** A single language range parsed from an Accept-Language header. */
export interface Language {
	/** The whole range as the client sent it (e.g. `zh-Hant-TW`), which Lookup truncates. */
	tag: string;
	/** Primary language subtag (e.g. `en`, or `*` for the wildcard range). */
	code: string;
	/** Script subtag when the tag carries one (e.g. `Hant` in `zh-Hant-TW`). */
	script?: string | null | undefined;
	/** Region subtag when present (e.g. `US` in `en-US`). */
	region?: string | undefined;
	/** Quality value from the `q` parameter, `1` when omitted; `0` means not acceptable. */
	quality: number;
}

/** Options that control how {@link pick} matches languages. */
export interface PickOptions {
	/**
	 * When `true`, match on the primary language code alone, ignoring script and
	 * region subtags (so `en-US` matches a supported `en-GB`).
	 */
	loose?: boolean | undefined;
}

/**
 * Serializes a parsed language back into a BCP 47 tag (`code-Script-REGION`),
 * skipping the script and region parts when absent.
 *
 * @param language - The parsed language to format.
 * @returns The formatted language tag.
 */
export function formatLanguageString(
	language: Pick<Language, "code" | "region" | "script">,
): string {
	let parts = [language.code];
	if (language.script) parts.push(language.script);
	if (language.region) parts.push(language.region);
	return parts.join("-");
}

/**
 * Parses an Accept-Language header into language descriptors sorted by
 * quality, highest first and in header order on ties, skipping malformed
 * segments so garbage input yields an empty list.
 *
 * @param acceptLanguage - The raw Accept-Language header value.
 * @returns The parsed languages, sorted by descending quality.
 * @example parse("en-US,en;q=0.9,es;q=0.8") // [{tag:"en-US",code:"en",region:"US",...}, ...]
 */
export function parse(acceptLanguage?: string): Language[] {
	let languages: Language[] = [];

	for (let range of (acceptLanguage || "").split(",")) {
		let match = LANGUAGE_RANGE.exec(range.trim());
		let tag = match?.[1];
		if (!tag) continue;

		let [code = tag, ...rest] = tag.split("-");
		let script = rest[0] !== undefined && SCRIPT_SUBTAG.test(rest[0]) ? rest.shift() : null;
		let region = rest[0] !== undefined && REGION_SUBTAG.test(rest[0]) ? rest[0] : undefined;
		let quality = match?.[2];

		languages.push({
			tag,
			code,
			script,
			region,
			quality: quality === undefined ? 1 : Number.parseFloat(quality),
		});
	}

	return languages.sort((a, b) => b.quality - a.quality);
}

/**
 * The RFC 4647 Lookup fallback pattern for one range: the whole tag, then each truncation from
 * the end, removing a dangling single-character subtag (`x` or an extension) with the subtag
 * after it, so `zh-Hant-CN-x-a-b` yields `zh-Hant-CN-x-a`, `zh-Hant-CN`, `zh-Hant`, `zh`.
 *
 * @param tag - The language range to truncate.
 * @returns The candidate tags, most specific first.
 */
export function lookupFallbacks(tag: string): string[] {
	let subtags = tag.split("-");
	let fallbacks: string[] = [];

	while (subtags.length > 0) {
		fallbacks.push(subtags.join("-"));
		subtags.pop();
		while (subtags.length > 0 && subtags.at(-1)?.length === 1) subtags.pop();
	}

	return fallbacks;
}

/**
 * Picks the best supported language: strict mode is RFC 4647 Lookup (each range, in priority
 * order, tries every truncation before the next range), loose mode matches by primary code. A
 * `q=0` range never matches and excludes the language it names; results keep their configured casing.
 *
 * @param supportedLanguages - Languages the application supports.
 * @param acceptLanguage - Raw header value or already-parsed languages.
 * @param options - Matching options; see {@link PickOptions}.
 * @returns The matched supported language, or `null` when none matches.
 * @example pick(["en", "es"], "es-UY,en;q=0.9") // "es"
 */
export function pick<T extends string>(
	supportedLanguages: readonly T[],
	acceptLanguage: string | Language[],
	options: PickOptions = { loose: false },
): T | null {
	if (!supportedLanguages?.length || !acceptLanguage) return null;

	let ranges = typeof acceptLanguage === "string" ? parse(acceptLanguage) : acceptLanguage;

	let excluded = new Set(
		ranges.filter((range) => range.quality === 0).map((range) => range.tag.toLowerCase()),
	);
	let candidates = supportedLanguages.filter((supported) => !excluded.has(supported.toLowerCase()));

	for (let range of ranges) {
		if (range.quality <= 0 || range.code === "*") continue;

		let match = options.loose
			? candidates.find((supported) => primary(supported) === range.code.toLowerCase())
			: lookup(candidates, range.tag);

		if (match !== undefined) return match;
	}

	return null;
}

/** The first supported language equal to one of the range's Lookup fallbacks, in fallback order. */
function lookup<T extends string>(candidates: readonly T[], tag: string): T | undefined {
	for (let fallback of lookupFallbacks(tag.toLowerCase())) {
		let match = candidates.find((supported) => supported.toLowerCase() === fallback);
		if (match !== undefined) return match;
	}
	return undefined;
}

/** The lowercased primary language subtag of a supported language. */
function primary(tag: string): string {
	return (tag.split("-")[0] ?? tag).toLowerCase();
}
