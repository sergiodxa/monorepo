/**
 * How OpenType feature tags correspond to AAT feature types and settings, so `shape()` takes
 * the same `features` option for a `morx` font as for an OpenType one, and `availableFeatures`
 * names a `morx` font's features by their OpenType tags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** An AAT feature selector: its feature type and setting. */
export interface AatSelector {
	type: number;
	setting: number;
}

/** AAT feature types the map uses. */
const TYPE = {
	LIGATURES: 1,
	CURSIVE_CONNECTION: 2,
	VERTICAL_SUBSTITUTION: 4,
	NUMBER_SPACING: 6,
	SMART_SWASH: 8,
	VERTICAL_POSITION: 10,
	FRACTIONS: 11,
	TYPOGRAPHIC_EXTRAS: 14,
	MATHEMATICAL_EXTRAS: 15,
	CHARACTER_ALTERNATIVES: 17,
	STYLE_OPTIONS: 19,
	CHARACTER_SHAPE: 20,
	NUMBER_CASE: 21,
	TEXT_SPACING: 22,
	RUBY_KANA: 28,
	CJK_VERTICAL_ROMAN_PLACEMENT: 31,
	ITALIC_CJK_ROMAN: 32,
	CASE_SENSITIVE_LAYOUT: 33,
	ALTERNATE_KANA: 34,
	STYLISTIC_ALTERNATIVES: 35,
	CONTEXTUAL_ALTERNATIVES: 36,
	LOWER_CASE: 37,
	UPPER_CASE: 38,
	KANA_SPACING: 25,
	UNICODE_DECOMPOSITION: 27,
};

/**
 * OpenType tags with the AAT selector that turns the same behavior on. Several tags may share
 * a selector; the first tag listed for a selector is the one it is reported as.
 */
const OPENTYPE_TO_AAT: readonly (readonly [string, number, number])[] = [
	["rlig", TYPE.LIGATURES, 0],
	["liga", TYPE.LIGATURES, 2],
	["dlig", TYPE.LIGATURES, 4],
	["clig", TYPE.LIGATURES, 18],
	["hlig", TYPE.LIGATURES, 20],
	["hist", TYPE.LIGATURES, 20],
	["curs", TYPE.CURSIVE_CONNECTION, 2],
	["vert", TYPE.VERTICAL_SUBSTITUTION, 0],
	["vrt2", TYPE.VERTICAL_SUBSTITUTION, 0],
	["tnum", TYPE.NUMBER_SPACING, 0],
	["pnum", TYPE.NUMBER_SPACING, 1],
	["init", TYPE.SMART_SWASH, 0],
	["fina", TYPE.SMART_SWASH, 2],
	["fin2", TYPE.SMART_SWASH, 2],
	["fin3", TYPE.SMART_SWASH, 2],
	["medi", TYPE.SMART_SWASH, 8],
	["med2", TYPE.SMART_SWASH, 8],
	["sups", TYPE.VERTICAL_POSITION, 1],
	["subs", TYPE.VERTICAL_POSITION, 2],
	["ordn", TYPE.VERTICAL_POSITION, 3],
	["sinf", TYPE.VERTICAL_POSITION, 4],
	["frac", TYPE.FRACTIONS, 2],
	["numr", TYPE.FRACTIONS, 2],
	["dnom", TYPE.FRACTIONS, 2],
	["afrc", TYPE.FRACTIONS, 1],
	["zero", TYPE.TYPOGRAPHIC_EXTRAS, 4],
	["mgrk", TYPE.MATHEMATICAL_EXTRAS, 10],
	["titl", TYPE.STYLE_OPTIONS, 4],
	["trad", TYPE.CHARACTER_SHAPE, 0],
	["smpl", TYPE.CHARACTER_SHAPE, 1],
	["jp78", TYPE.CHARACTER_SHAPE, 2],
	["jp83", TYPE.CHARACTER_SHAPE, 3],
	["jp90", TYPE.CHARACTER_SHAPE, 4],
	["expt", TYPE.CHARACTER_SHAPE, 10],
	["jp04", TYPE.CHARACTER_SHAPE, 11],
	["hojo", TYPE.CHARACTER_SHAPE, 12],
	["nlck", TYPE.CHARACTER_SHAPE, 13],
	["tnam", TYPE.CHARACTER_SHAPE, 14],
	["onum", TYPE.NUMBER_CASE, 0],
	["lnum", TYPE.NUMBER_CASE, 1],
	["pwid", TYPE.TEXT_SPACING, 0],
	["fwid", TYPE.TEXT_SPACING, 1],
	["hwid", TYPE.TEXT_SPACING, 2],
	["half", TYPE.TEXT_SPACING, 2],
	["twid", TYPE.TEXT_SPACING, 3],
	["qwid", TYPE.TEXT_SPACING, 4],
	["palt", TYPE.TEXT_SPACING, 5],
	["halt", TYPE.TEXT_SPACING, 6],
	["pkna", TYPE.KANA_SPACING, 1],
	["ccmp", TYPE.UNICODE_DECOMPOSITION, 0],
	["ruby", TYPE.RUBY_KANA, 2],
	["valt", TYPE.CJK_VERTICAL_ROMAN_PLACEMENT, 0],
	["cpct", TYPE.CJK_VERTICAL_ROMAN_PLACEMENT, 0],
	["ital", TYPE.ITALIC_CJK_ROMAN, 2],
	["case", TYPE.CASE_SENSITIVE_LAYOUT, 0],
	["cpsp", TYPE.CASE_SENSITIVE_LAYOUT, 2],
	["hkna", TYPE.ALTERNATE_KANA, 0],
	["vkna", TYPE.ALTERNATE_KANA, 2],
	["calt", TYPE.CONTEXTUAL_ALTERNATIVES, 0],
	["swsh", TYPE.CONTEXTUAL_ALTERNATIVES, 2],
	["cswh", TYPE.CONTEXTUAL_ALTERNATIVES, 4],
	["smcp", TYPE.LOWER_CASE, 1],
	["pcap", TYPE.LOWER_CASE, 2],
	["c2sc", TYPE.UPPER_CASE, 1],
	["c2pc", TYPE.UPPER_CASE, 2],
	...Array.from({ length: 20 }, (_, index) => {
		let set = `ss${String(index + 1).padStart(2, "0")}`;
		return [set, TYPE.STYLISTIC_ALTERNATIVES, (index + 1) * 2] as const;
	}),
	...Array.from({ length: 99 }, (_, index) => {
		let variant = `cv${String(index + 1).padStart(2, "0")}`;
		return [variant, TYPE.CHARACTER_ALTERNATIVES, index + 1] as const;
	}),
];

/** AAT selectors by OpenType tag. */
const SELECTORS = new Map<string, AatSelector>(
	OPENTYPE_TO_AAT.map(([tag, type, setting]) => [tag, { type, setting }]),
);

/** OpenType tags by AAT selector key (`type << 16 | setting`), the first tag listed winning. */
const TAGS = new Map<number, string>();
for (let [tag, type, setting] of OPENTYPE_TO_AAT) {
	let key = (type << 16) | setting;
	if (!TAGS.has(key)) TAGS.set(key, tag);
}

/**
 * The AAT selector that turns an OpenType feature on, `null` for a tag without one.
 *
 * @param tag - An OpenType feature tag.
 * @example aatSelector("liga") // { type: 1, setting: 2 }
 */
export function aatSelector(tag: string): AatSelector | null {
	return SELECTORS.get(tag) ?? null;
}

/**
 * The OpenType tag an AAT selector stands for, `null` for a selector without one (an "off"
 * setting, or a feature OpenType has no tag for).
 *
 * @param type - AAT feature type.
 * @param setting - AAT feature setting.
 * @example openTypeTag(1, 2) // "liga"
 */
export function openTypeTag(type: number, setting: number): string | null {
	return TAGS.get((type << 16) | setting) ?? null;
}
