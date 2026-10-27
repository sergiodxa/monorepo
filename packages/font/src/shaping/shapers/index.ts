/**
 * The shaper registry: which shaper handles each OpenType script tag. A script shaper
 * registers here under every tag its script uses (old and new Indic tags alike); a script
 * that is not listed shapes with the default shaper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArabicShaper } from "./arabic.js";
import { DefaultShaper } from "./default.js";
import { HangulShaper } from "./hangul.js";
import { HebrewShaper } from "./hebrew.js";
import { IndicShaper } from "./indic.js";
import { ThaiShaper } from "./thai.js";
import { UniversalShaper } from "./use.js";

export { DefaultShaper } from "./default.js";
export type { ZeroMarkWidths } from "./default.js";

/** The shaper for scripts without one of their own. */
const DEFAULT_SHAPER = new DefaultShaper();

/** The shaper for cursive joining scripts. */
const ARABIC_SHAPER = new ArabicShaper();

/** The Thai and Lao shaper. */
const THAI_SHAPER = new ThaiShaper();

/** The Indic shaper, for the Brahmic scripts with their own reordering rules and Khmer. */
const INDIC_SHAPER = new IndicShaper();

/** The Universal Shaping Engine, for the Brahmic-derived scripts without a shaper of their own. */
const USE_SHAPER = new UniversalShaper();

/** Script shapers by OpenType script tag. */
const SHAPERS = new Map<string, DefaultShaper>([
	["DFLT", DEFAULT_SHAPER],
	["latn", DEFAULT_SHAPER],
	["arab", ARABIC_SHAPER],
	["mong", ARABIC_SHAPER],
	["syrc", ARABIC_SHAPER],
	["nko ", ARABIC_SHAPER],
	["phag", ARABIC_SHAPER],
	["mand", ARABIC_SHAPER],
	["mani", ARABIC_SHAPER],
	["phlp", ARABIC_SHAPER],
	["hang", new HangulShaper()],
	["hebr", new HebrewShaper()],
	["thai", THAI_SHAPER],
	["lao ", THAI_SHAPER],
	["bng2", INDIC_SHAPER],
	["beng", INDIC_SHAPER],
	["dev2", INDIC_SHAPER],
	["deva", INDIC_SHAPER],
	["gjr2", INDIC_SHAPER],
	["gujr", INDIC_SHAPER],
	["gur2", INDIC_SHAPER],
	["guru", INDIC_SHAPER],
	["knd2", INDIC_SHAPER],
	["knda", INDIC_SHAPER],
	["mlm2", INDIC_SHAPER],
	["mlym", INDIC_SHAPER],
	["ory2", INDIC_SHAPER],
	["orya", INDIC_SHAPER],
	["tml2", INDIC_SHAPER],
	["taml", INDIC_SHAPER],
	["tel2", INDIC_SHAPER],
	["telu", INDIC_SHAPER],
	["khmr", INDIC_SHAPER],
	["sinh", INDIC_SHAPER],
	["bali", USE_SHAPER],
	["batk", USE_SHAPER],
	["brah", USE_SHAPER],
	["bugi", USE_SHAPER],
	["buhd", USE_SHAPER],
	["cakm", USE_SHAPER],
	["cham", USE_SHAPER],
	["dupl", USE_SHAPER],
	["egyp", USE_SHAPER],
	["gran", USE_SHAPER],
	["hano", USE_SHAPER],
	["java", USE_SHAPER],
	["kthi", USE_SHAPER],
	["kali", USE_SHAPER],
	["khar", USE_SHAPER],
	["khoj", USE_SHAPER],
	["sind", USE_SHAPER],
	["lepc", USE_SHAPER],
	["limb", USE_SHAPER],
	["mahj", USE_SHAPER],
	["mtei", USE_SHAPER],
	["modi", USE_SHAPER],
	["hmng", USE_SHAPER],
	["rjng", USE_SHAPER],
	["saur", USE_SHAPER],
	["shrd", USE_SHAPER],
	["sidd", USE_SHAPER],
	["sund", USE_SHAPER],
	["sylo", USE_SHAPER],
	["tglg", USE_SHAPER],
	["tagb", USE_SHAPER],
	["tale", USE_SHAPER],
	["lana", USE_SHAPER],
	["tavt", USE_SHAPER],
	["takr", USE_SHAPER],
	["tibt", USE_SHAPER],
	["tfng", USE_SHAPER],
	["tirh", USE_SHAPER],
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
