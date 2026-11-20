/**
 * Picks the file a player loads from an asset source: a URL or a Blob, or a map of locale to
 * either. A locale map falls back from the exact locale to its language and then to the map's
 * first entry, so a novel that ships one language still draws and plays in every other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AssetSource } from "../declarations.js";

/** The object URL made for each Blob, so every `<img>` and stream of one Blob shares one URL. */
const OBJECT_URLS = new WeakMap<Blob, string>();

/**
 * The file `source` holds for `locale`: a URL to load, or a Blob to play or draw directly.
 *
 * @param source - A URL or a Blob, or a map of locale to either.
 * @param locale - The reader's locale, such as `es-MX`.
 * @returns The exact locale's file, its language's (`es`), the first the map lists, or `""`.
 * @example pickSource({ en: "/sfx/door-en.ogg", ja: chime }, "ja-JP"); // chime
 */
export function pickSource(source: AssetSource, locale: string): string | Blob {
	if (typeof source === "string" || source instanceof Blob) return source;
	let language = locale.split("-")[0] ?? locale;
	return source[locale] ?? source[language] ?? Object.values(source)[0] ?? "";
}

/**
 * The object URL of a Blob, made once and kept for the life of the page: declared assets live as
 * long as the novel does, so each URL stays valid for every replay. Outside a document, where a
 * server renders the stage, it answers `""`, and the page sets the URL when it hydrates.
 *
 * @param blob - The file.
 * @returns A `blob:` URL, the same one on every call for the same Blob.
 */
export function objectUrl(blob: Blob): string {
	let cached = OBJECT_URLS.get(blob);
	if (cached !== undefined) return cached;
	if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return "";
	let url = URL.createObjectURL(blob);
	OBJECT_URLS.set(blob, url);
	return url;
}

/**
 * The URL to load for `source` in `locale`; a Blob answers its {@link objectUrl}.
 *
 * @param source - A URL or a Blob, or a map of locale to either.
 * @param locale - The reader's locale, such as `es-MX`.
 * @returns The exact locale's file, its language's (`es`), or the first one the map lists.
 * @example resolveSource({ en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" }, "ja-JP"); // "/cg/letter-ja.webp"
 */
export function resolveSource(source: AssetSource, locale: string): string {
	let file = pickSource(source, locale);
	return typeof file === "string" ? file : objectUrl(file);
}
