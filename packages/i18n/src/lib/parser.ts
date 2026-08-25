/**
 * Accept-Language header parsing and matching. Parses the raw header into
 * quality-sorted language descriptors and picks the best match against the
 * application-supported languages, with strict and loose matching modes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Matches every language range (with optional quality) in an Accept-Language header. */
const ACCEPT_LANGUAGE_REGEX =
	/[ ]*((([a-zA-Z]+(-[a-zA-Z0-9]+){0,2})|\*)(;[ ]*q=[0-1](\.[0-9]+)?[ ]*)?)*/g;

/** A single language range parsed from an Accept-Language header. */
export interface Language {
	/** Primary language subtag (e.g. `en`, or `*` for the wildcard range). */
	code: string;
	/** Script subtag when the tag has three parts (e.g. `Hant` in `zh-Hant-TW`). */
	script?: string | null | undefined;
	/** Region subtag when present (e.g. `US` in `en-US`). */
	region?: string | undefined;
	/** Quality value from the `q` parameter, `1.0` when omitted. */
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
 * quality, highest first, skipping malformed segments so garbage input
 * yields an empty list.
 *
 * @param acceptLanguage - The raw Accept-Language header value.
 * @returns The parsed languages, sorted by descending quality.
 * @example parse("en-US,en;q=0.9,es;q=0.8") // [{code:"en",region:"US",...}, ...]
 */
export function parse(acceptLanguage?: string): Language[] {
	let matches = (acceptLanguage || "").match(ACCEPT_LANGUAGE_REGEX) ?? [];

	let languages: Language[] = [];

	for (let match of matches) {
		if (!match) continue;

		let bits = match.trim().split(";");
		let ietf = bits[0]?.split("-") ?? [];
		let hasScript = ietf.length === 3;

		let code = ietf[0];
		if (!code) continue;

		languages.push({
			code,
			script: hasScript ? ietf[1] : null,
			region: hasScript ? ietf[2] : ietf[1],
			quality: parseQuality(bits[1]),
		});
	}

	return languages.sort((a, b) => b.quality - a.quality);
}

/**
 * Reads the quality value from a `q=<value>` parameter, treating missing or
 * unparsable values as the spec default of `1.0`.
 *
 * @param bit - The raw `q=<value>` segment, if any.
 * @returns The parsed quality value.
 */
function parseQuality(bit: string | undefined): number {
	if (!bit) return 1.0;
	let value = Number.parseFloat(bit.split("=")[1] ?? "");
	return Number.isNaN(value) ? 1.0 : value;
}

/**
 * Picks the best supported language for an Accept-Language header (or
 * pre-parsed languages), honoring the client's quality ordering. Strict mode
 * requires matching script and region subtags; loose mode matches by primary code.
 *
 * @param supportedLanguages - Languages the application supports.
 * @param acceptLanguage - Raw header value or already-parsed languages.
 * @param options - Matching options; see {@link PickOptions}.
 * @returns The matched supported language, or `null` when none matches.
 * @example pick(["en", "es"], "fr;q=1,es;q=0.5") // "es"
 */
export function pick<T extends string>(
	supportedLanguages: readonly T[],
	acceptLanguage: string | Language[],
	options: PickOptions = { loose: false },
): T | null {
	if (!supportedLanguages?.length || !acceptLanguage) return null;

	let parsedAcceptLanguage =
		typeof acceptLanguage === "string" ? parse(acceptLanguage) : acceptLanguage;

	let supported = supportedLanguages.map((support) => {
		let bits = support.split("-");
		let hasScript = bits.length === 3;

		return {
			code: bits[0] ?? support,
			script: hasScript ? bits[1] : null,
			region: hasScript ? bits[2] : bits[1],
		};
	});

	for (let language of parsedAcceptLanguage) {
		if (!language) continue;
		let langCode = language.code.toLowerCase();
		let langScript = language.script?.toLowerCase();
		let langRegion = language.region?.toLowerCase();

		for (let supportedLanguage of supported) {
			if (langCode !== supportedLanguage.code.toLowerCase()) continue;

			let supportedScript = supportedLanguage.script?.toLowerCase();
			let supportedRegion = supportedLanguage.region?.toLowerCase();

			if (
				(options.loose || !langScript || langScript === supportedScript) &&
				(options.loose || !langRegion || langRegion === supportedRegion)
			) {
				return formatLanguageString(supportedLanguage) as T;
			}
		}
	}

	return null;
}
