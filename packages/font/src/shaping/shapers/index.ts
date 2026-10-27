/**
 * The shaper registry: which shaper handles each OpenType script tag. A script shaper
 * registers here under every tag its script uses (old and new Indic tags alike); a script
 * that is not listed shapes with the default shaper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DefaultShaper } from "./default.js";

export { DefaultShaper } from "./default.js";
export type { ZeroMarkWidths } from "./default.js";

/** The shaper for scripts without one of their own. */
const DEFAULT_SHAPER = new DefaultShaper();

/** Script shapers by OpenType script tag. */
const SHAPERS = new Map<string, DefaultShaper>([
	["DFLT", DEFAULT_SHAPER],
	["latn", DEFAULT_SHAPER],
]);

/**
 * The shaper for the first of the given script tags that has one, the default shaper
 * otherwise.
 *
 * @param scripts - OpenType script tags in order of preference.
 */
export function chooseShaper(scripts: readonly string[]): DefaultShaper {
	for (let tag of scripts) {
		let shaper = SHAPERS.get(tag);
		if (shaper !== undefined) return shaper;
	}
	return DEFAULT_SHAPER;
}
