/**
 * The Indic shaper's character classes: each character's shaping category and the visual
 * position it takes in a syllable, derived at run time from the Unicode Indic syllabic and
 * positional categories, and the per-script settings of the reordering rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { indicPositionalCategory, indicSyllabicCategory } from "../unicode/properties.js";

/**
 * Shaping categories as bit flags, so a test against several is one mask; the syllable
 * machine reads each flag's bit index.
 */
export const CATEGORIES = {
	X: 1 << 0,
	C: 1 << 1,
	V: 1 << 2,
	N: 1 << 3,
	H: 1 << 4,
	ZWNJ: 1 << 5,
	ZWJ: 1 << 6,
	M: 1 << 7,
	SM: 1 << 8,
	VD: 1 << 9,
	A: 1 << 10,
	Placeholder: 1 << 11,
	Dotted_Circle: 1 << 12,
	/** A Khmer register shifter. */
	RS: 1 << 13,
	/** A Khmer-style virama, which stacks the next consonant below. */
	Coeng: 1 << 14,
	/** A repha encoded as its own character, logical or visual. */
	Repha: 1 << 15,
	Ra: 1 << 16,
	/** A medial consonant. */
	CM: 1 << 17,
	/** A sign that takes marks: avagraha and the like. */
	Symbol: 1 << 18,
};

/** Visual positions in a syllable as bit flags, ordered left to right by value. */
export const POSITIONS = {
	Start: 1 << 0,
	Ra_To_Become_Reph: 1 << 1,
	Pre_M: 1 << 2,
	Pre_C: 1 << 3,
	Base_C: 1 << 4,
	After_Main: 1 << 5,
	Above_C: 1 << 6,
	Before_Sub: 1 << 7,
	Below_C: 1 << 8,
	After_Sub: 1 << 9,
	Before_Post: 1 << 10,
	Post_C: 1 << 11,
	After_Post: 1 << 12,
	Final_C: 1 << 13,
	SMVD: 1 << 14,
	End: 1 << 15,
};

/** Categories that act as a syllable's consonant. */
export const CONSONANT_FLAGS =
	CATEGORIES.C |
	CATEGORIES.Ra |
	CATEGORIES.CM |
	CATEGORIES.V |
	CATEGORIES.Placeholder |
	CATEGORIES.Dotted_Circle;

/** Zero width joiner and non-joiner. */
export const JOINER_FLAGS = CATEGORIES.ZWJ | CATEGORIES.ZWNJ;

/** Virama and coeng. */
export const HALANT_OR_COENG_FLAGS = CATEGORIES.H | CATEGORIES.Coeng;

/** Where a script's reph goes and how it is spelled. */
export type RephMode = "Implicit" | "Explicit" | "Log_Repha" | "Vis_Repha";

/** How a script picks a syllable's base consonant. */
export type BasePosition = "Last" | "First";

/** Which consonants around the base take `blwf`. */
export type BelowFormMode = "Pre_And_Post" | "Post_Only";

/** A script's settings for the reordering rules. */
export interface IndicConfig {
	/** Whether fonts under the old script tag (`deva` rather than `dev2`) follow the old rules. */
	hasOldSpec: boolean;
	virama: number;
	basePosition: BasePosition;
	rephPosition: number;
	rephMode: RephMode;
	belowFormMode: BelowFormMode;
}

/** The settings for a script without its own. */
const DEFAULT_CONFIG: IndicConfig = {
	hasOldSpec: false,
	virama: 0,
	basePosition: "Last",
	rephPosition: POSITIONS.Before_Post,
	rephMode: "Implicit",
	belowFormMode: "Pre_And_Post",
};

/** Settings by ISO 15924 script code. */
const CONFIGS: ReadonlyMap<string, IndicConfig> = new Map([
	["Deva", { ...DEFAULT_CONFIG, hasOldSpec: true, virama: 0x094d }],
	[
		"Beng",
		{ ...DEFAULT_CONFIG, hasOldSpec: true, virama: 0x09cd, rephPosition: POSITIONS.After_Sub },
	],
	[
		"Guru",
		{ ...DEFAULT_CONFIG, hasOldSpec: true, virama: 0x0a4d, rephPosition: POSITIONS.Before_Sub },
	],
	["Gujr", { ...DEFAULT_CONFIG, hasOldSpec: true, virama: 0x0acd }],
	[
		"Orya",
		{ ...DEFAULT_CONFIG, hasOldSpec: true, virama: 0x0b4d, rephPosition: POSITIONS.After_Main },
	],
	[
		"Taml",
		{ ...DEFAULT_CONFIG, hasOldSpec: true, virama: 0x0bcd, rephPosition: POSITIONS.After_Post },
	],
	[
		"Telu",
		{
			...DEFAULT_CONFIG,
			hasOldSpec: true,
			virama: 0x0c4d,
			rephPosition: POSITIONS.After_Post,
			rephMode: "Explicit",
			belowFormMode: "Post_Only",
		},
	],
	[
		"Knda",
		{
			...DEFAULT_CONFIG,
			hasOldSpec: true,
			virama: 0x0ccd,
			rephPosition: POSITIONS.After_Post,
			belowFormMode: "Post_Only",
		},
	],
	[
		"Mlym",
		{
			...DEFAULT_CONFIG,
			hasOldSpec: true,
			virama: 0x0d4d,
			rephPosition: POSITIONS.After_Main,
			rephMode: "Log_Repha",
		},
	],
	[
		"Khmr",
		{
			...DEFAULT_CONFIG,
			virama: 0x17d2,
			basePosition: "First",
			rephPosition: POSITIONS.Ra_To_Become_Reph,
			rephMode: "Vis_Repha",
		},
	],
]);

/**
 * The reordering settings for a script, the default ones for a script without its own.
 *
 * @param iso - An ISO 15924 code.
 */
export function indicConfig(iso: string | null): IndicConfig {
	return CONFIGS.get(iso ?? "") ?? DEFAULT_CONFIG;
}

/**
 * Khmer split vowels Unicode keeps whole: each draws its pre-base part, U+17C1, before the
 * rest, so the shaper splits them before reordering.
 */
export const INDIC_DECOMPOSITIONS: ReadonlyMap<number, readonly number[]> = new Map([
	[0x17be, [0x17c1, 0x17be]],
	[0x17bf, [0x17c1, 0x17bf]],
	[0x17c0, [0x17c1, 0x17c0]],
	[0x17c4, [0x17c1, 0x17c4]],
	[0x17c5, [0x17c1, 0x17c5]],
]);

/** Shaping categories by Unicode Indic syllabic category; anything unlisted is `X`. */
const CATEGORY_BY_SYLLABIC: Readonly<Record<string, keyof typeof CATEGORIES>> = {
	Avagraha: "Symbol",
	Bindu: "SM",
	Brahmi_Joining_Number: "Placeholder",
	Cantillation_Mark: "A",
	Consonant: "C",
	Consonant_Dead: "C",
	Consonant_Final: "CM",
	Consonant_Head_Letter: "C",
	Consonant_Killer: "M",
	Consonant_Medial: "CM",
	Consonant_Placeholder: "Placeholder",
	Consonant_Preceding_Repha: "Repha",
	Consonant_Prefixed: "X",
	Consonant_Subjoined: "CM",
	Consonant_Succeeding_Repha: "N",
	Consonant_With_Stacker: "Repha",
	Gemination_Mark: "SM",
	Invisible_Stacker: "Coeng",
	Joiner: "ZWJ",
	Modifying_Letter: "X",
	Non_Joiner: "ZWNJ",
	Nukta: "N",
	Number: "Placeholder",
	Number_Joiner: "Placeholder",
	Pure_Killer: "M",
	Register_Shifter: "RS",
	Syllable_Modifier: "M",
	Tone_Letter: "X",
	Tone_Mark: "N",
	Virama: "H",
	Visarga: "SM",
	Vowel: "V",
	Vowel_Dependent: "M",
	Vowel_Independent: "V",
};

/**
 * Characters whose shaping category differs from what their syllabic category gives: each
 * script's Ra (which forms reph), Vedic signs, hyphens that carry marks, the dotted circle.
 */
const CATEGORY_OVERRIDES: ReadonlyMap<number, keyof typeof CATEGORIES> = new Map([
	[0x0953, "SM"],
	[0x0954, "SM"],
	[0x0a72, "C"],
	[0x0a73, "C"],
	[0x1cf5, "C"],
	[0x1cf6, "C"],
	[0x1ce2, "A"],
	[0x1ce3, "A"],
	[0x1ce4, "A"],
	[0x1ce5, "A"],
	[0x1ce6, "A"],
	[0x1ce7, "A"],
	[0x1ce8, "A"],
	[0x1ced, "A"],
	[0xa8f2, "Symbol"],
	[0xa8f3, "Symbol"],
	[0xa8f4, "Symbol"],
	[0xa8f5, "Symbol"],
	[0xa8f6, "Symbol"],
	[0xa8f7, "Symbol"],
	[0x1ce9, "Symbol"],
	[0x1cea, "Symbol"],
	[0x1ceb, "Symbol"],
	[0x1cec, "Symbol"],
	[0x1cee, "Symbol"],
	[0x1cef, "Symbol"],
	[0x1cf0, "Symbol"],
	[0x1cf1, "Symbol"],
	[0x17c6, "N"],
	[0x2010, "Placeholder"],
	[0x2011, "Placeholder"],
	[0x25cc, "Dotted_Circle"],
	[0x0930, "Ra"],
	[0x09b0, "Ra"],
	[0x09f0, "Ra"],
	[0x0a30, "Ra"],
	[0x0ab0, "Ra"],
	[0x0b30, "Ra"],
	[0x0bb0, "Ra"],
	[0x0c30, "Ra"],
	[0x0cb0, "Ra"],
	[0x0d30, "Ra"],
	[0x0dbb, "Ra"],
	[0x179a, "Ra"],
]);

/**
 * Positions by Unicode Indic positional category. A split sign takes the position of its
 * last part.
 */
const POSITION_BY_POSITIONAL: Readonly<Record<string, keyof typeof POSITIONS>> = {
	Left: "Pre_C",
	Top: "Above_C",
	Bottom: "Below_C",
	Right: "Post_C",
	Bottom_And_Right: "Post_C",
	Left_And_Right: "Post_C",
	Top_And_Bottom: "Below_C",
	Top_And_Bottom_And_Right: "Post_C",
	Top_And_Left: "Above_C",
	Top_And_Left_And_Right: "Post_C",
	Top_And_Right: "Post_C",
	Overstruck: "After_Main",
	Visual_Order_Left: "Pre_M",
};

/** The Unicode blocks whose matras reorder by script, as first code point and name. */
const BLOCKS: readonly [first: number, name: string][] = [
	[0x0900, "Devanagari"],
	[0x0980, "Bengali"],
	[0x0a00, "Gurmukhi"],
	[0x0a80, "Gujarati"],
	[0x0b00, "Oriya"],
	[0x0b80, "Tamil"],
	[0x0c00, "Telugu"],
	[0x0c80, "Kannada"],
	[0x0d00, "Malayalam"],
	[0x0d80, "Sinhala"],
	[0x0e00, ""],
	[0x1780, "Khmer"],
	[0x1800, ""],
];

/** Where a right-side matra goes, by block, `After_Sub` for blocks not listed. */
const POST_MATRA: Readonly<Record<string, keyof typeof POSITIONS>> = {
	Devanagari: "After_Sub",
	Bengali: "After_Post",
	Gurmukhi: "After_Post",
	Gujarati: "After_Post",
	Oriya: "After_Post",
	Tamil: "After_Post",
	Malayalam: "After_Post",
	Khmer: "After_Post",
};

/** Where an above-base matra goes, by block, `After_Sub` for blocks not listed. */
const ABOVE_MATRA: Readonly<Record<string, keyof typeof POSITIONS>> = {
	Gurmukhi: "After_Post",
	Oriya: "After_Main",
	Telugu: "Before_Sub",
	Kannada: "Before_Sub",
	Khmer: "After_Post",
};

/** Where a below-base matra goes, by block, `After_Sub` for blocks not listed. */
const BELOW_MATRA: Readonly<Record<string, keyof typeof POSITIONS>> = {
	Gurmukhi: "After_Post",
	Gujarati: "After_Post",
	Tamil: "After_Post",
	Telugu: "Before_Sub",
	Kannada: "Before_Sub",
	Malayalam: "After_Post",
	Khmer: "After_Post",
};

/**
 * The block a code point belongs to among the Indic blocks, `""` outside them.
 *
 * @param codePoint - A code point.
 */
function block(codePoint: number): string {
	let name = "";
	for (let [first, found] of BLOCKS) {
		if (codePoint < first) break;
		name = found;
	}
	return name;
}

/**
 * Where a matra goes relative to the consonants: left matras before them, others by block,
 * Telugu and Kannada splitting their right matras between before and after subjoined forms.
 *
 * @param codePoint - The matra.
 * @param position - The position its positional category gives.
 */
function matraPosition(
	codePoint: number,
	position: keyof typeof POSITIONS,
): keyof typeof POSITIONS {
	let name = block(codePoint);
	switch (position) {
		case "Pre_C":
			return "Pre_M";
		case "Post_C":
			if (name === "Telugu") return codePoint <= 0x0c42 ? "Before_Sub" : "After_Sub";
			if (name === "Kannada") {
				return codePoint < 0x0cc3 || codePoint > 0x0cd6 ? "Before_Sub" : "After_Sub";
			}
			return POST_MATRA[name] ?? "After_Sub";
		case "Above_C":
			return ABOVE_MATRA[name] ?? "After_Sub";
		case "Below_C":
			return BELOW_MATRA[name] ?? "After_Sub";
		default:
			return position;
	}
}

/**
 * A character's shaping category as a flag of `CATEGORIES`.
 *
 * @param codePoint - A code point.
 */
export function indicCategory(codePoint: number): number {
	let name =
		CATEGORY_OVERRIDES.get(codePoint) ??
		CATEGORY_BY_SYLLABIC[indicSyllabicCategory(codePoint)] ??
		"X";
	return CATEGORIES[name];
}

/**
 * A character's initial visual position as a flag of `POSITIONS`: consonants are bases,
 * matras go where their block puts them, syllable modifiers and Vedic signs go last.
 *
 * @param codePoint - A code point.
 * @param category - Its shaping category.
 */
export function indicPosition(codePoint: number, category: number): number {
	let position = POSITION_BY_POSITIONAL[indicPositionalCategory(codePoint)] ?? "End";
	if ((category & CONSONANT_FLAGS) !== 0) position = "Base_C";
	else if (category === CATEGORIES.M) position = matraPosition(codePoint, position);
	else if ((category & (CATEGORIES.SM | CATEGORIES.VD | CATEGORIES.A | CATEGORIES.Symbol)) !== 0) {
		position = "SMVD";
	}
	if (codePoint === 0x0b01) position = "Before_Sub";
	return POSITIONS[position];
}

/**
 * The parts of a multi-part dependent vowel sign, by its canonical decomposition, or `null`
 * for any other character; each part reorders on its own.
 *
 * @param codePoint - A code point.
 */
export function vowelDecomposition(codePoint: number): number[] | null {
	if (indicSyllabicCategory(codePoint) !== "Vowel_Dependent") return null;
	let parts = Array.from(
		String.fromCodePoint(codePoint).normalize("NFD"),
		(character) => character.codePointAt(0) ?? 0,
	);
	if (parts.length === 1 && parts[0] === codePoint) return null;
	return parts;
}
