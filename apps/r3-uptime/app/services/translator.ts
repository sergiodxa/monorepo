/**
 * Minimal server-side translator over the app's locale dictionaries. Resolves a
 * dot-path key against a nested locale object and interpolates `{{param}}`
 * placeholders, matching the OLD APP's existing translation key/interpolation
 * syntax without pulling in an i18next runtime this server-only app doesn't need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A locale dictionary: an arbitrarily nested object of string leaves. */
export type Locale = Record<string, unknown>;

/** A `t(key, params)` function bound to one resolved locale. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Looks up `key` (dot-separated path) in `dict` and interpolates `{{param}}`
 * placeholders from `params`. Returns `key` itself when the path resolves to
 * anything other than a string, so a missing translation is visible rather than
 * silently blank.
 */
export function translate(
	dict: Locale,
	key: string,
	params?: Record<string, string | number>,
): string {
	let value: unknown = key
		.split(".")
		.reduce<unknown>(
			(node, segment) =>
				node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
			dict,
		);

	if (typeof value !== "string") return key;
	if (!params) return value;

	return value.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
		let replacement = params[name];
		return replacement === undefined ? match : String(replacement);
	});
}

/** Binds `translate` to one locale dictionary. */
export function createTranslator(dict: Locale): Translate {
	return (key, params) => translate(dict, key, params);
}
