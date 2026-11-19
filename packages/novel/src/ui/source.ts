/**
 * Picks the file a player loads from an asset source: one URL, or a map of locale to URL. A
 * locale map falls back from the exact locale to its language and then to the map's first
 * entry, so a novel that ships one language still draws and plays in every other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AssetSource } from "../declarations.js";

/**
 * The URL to load for `source` in `locale`.
 *
 * @param source - A URL, or a map of locale to URL.
 * @param locale - The reader's locale, such as `es-MX`.
 * @returns The exact locale's file, its language's (`es`), or the first one the map lists.
 * @example resolveSource({ en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" }, "ja-JP"); // "/cg/letter-ja.webp"
 */
export function resolveSource(source: AssetSource, locale: string): string {
	if (typeof source === "string") return source;
	let language = locale.split("-")[0] ?? locale;
	return source[locale] ?? source[language] ?? Object.values(source)[0] ?? "";
}
