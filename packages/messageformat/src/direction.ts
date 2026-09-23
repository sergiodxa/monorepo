/**
 * Base text direction of a locale, derived from its likely script, which decides whether a
 * message and its number placeholders need bidi isolation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Direction } from "./values.js";

/** ISO 15924 codes of the scripts written right to left. */
const RTL_SCRIPTS = new Set([
	"Adlm",
	"Arab",
	"Aran",
	"Hebr",
	"Mand",
	"Mend",
	"Nkoo",
	"Rohg",
	"Samr",
	"Syrc",
	"Thaa",
	"Yezi",
]);

/**
 * `rtl` when the locale's likely script is written right to left, `ltr` otherwise,
 * including for identifiers `Intl.Locale` rejects.
 */
export function localeDirection(locale: string): Direction {
	let script: string | undefined;
	try {
		script = new Intl.Locale(locale).maximize().script;
	} catch {
		return "ltr";
	}
	return script && RTL_SCRIPTS.has(script) ? "rtl" : "ltr";
}
