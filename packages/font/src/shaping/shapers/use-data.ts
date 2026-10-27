/**
 * Universal Shaping Engine categories, derived at run time from each character's Indic
 * syllabic category, Indic positional category and general category as the USE
 * specification classifies them, with the specification's per-character overrides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	generalCategory,
	indicPositionalCategory,
	indicSyllabicCategory,
} from "../unicode/properties.js";

/** What a classification rule tests: the syllabic category, general category or code point. */
interface Rule {
	syllabic?: string;
	general?: string;
	/** A general category the character must not have. */
	notGeneral?: string;
	codePoints?: readonly number[];
	/** Code points the rule leaves out. */
	except?: readonly number[];
}

/**
 * The USE categories in classification order: a character takes the first whose rules it
 * matches, `O` (other) when its syllabic category is `Other`.
 */
const RULES: readonly [category: string, rules: readonly Rule[]][] = [
	[
		"B",
		[
			{ syllabic: "Number" },
			{ syllabic: "Avagraha", general: "Lo" },
			{ syllabic: "Bindu", general: "Lo" },
			{ syllabic: "Consonant" },
			{ syllabic: "Consonant_Final", general: "Lo" },
			{ syllabic: "Consonant_Head_Letter" },
			{ syllabic: "Consonant_Medial", general: "Lo" },
			{ syllabic: "Consonant_Subjoined", general: "Lo" },
			{ syllabic: "Tone_Letter" },
			{ syllabic: "Vowel", general: "Lo" },
			{ syllabic: "Vowel_Independent" },
			{ syllabic: "Vowel_Dependent", general: "Lo" },
		],
	],
	["CGJ", [{ codePoints: [0x034f] }]],
	[
		"CM",
		[{ syllabic: "Nukta" }, { syllabic: "Gemination_Mark" }, { syllabic: "Consonant_Killer" }],
	],
	["CS", [{ syllabic: "Consonant_With_Stacker" }]],
	[
		"F",
		[{ syllabic: "Consonant_Final", notGeneral: "Lo" }, { syllabic: "Consonant_Succeeding_Repha" }],
	],
	["FM", [{ syllabic: "Syllable_Modifier" }]],
	[
		"GB",
		[
			{ syllabic: "Consonant_Placeholder" },
			{ codePoints: [0x2015, 0x2022, 0x25fb, 0x25fc, 0x25fd, 0x25fe] },
		],
	],
	["H", [{ syllabic: "Virama" }, { syllabic: "Invisible_Stacker" }]],
	["HN", [{ syllabic: "Number_Joiner" }]],
	[
		"IND",
		[
			{ syllabic: "Consonant_Dead" },
			{ syllabic: "Modifying_Letter" },
			{ general: "Po", except: [0x104e, 0x2022] },
		],
	],
	["M", [{ syllabic: "Consonant_Medial", notGeneral: "Lo" }]],
	["N", [{ syllabic: "Brahmi_Joining_Number" }]],
	["R", [{ syllabic: "Consonant_Preceding_Repha" }, { syllabic: "Consonant_Prefixed" }]],
	["Rsv", [{ general: "Cn" }]],
	["S", [{ general: "So", except: [0x25cc] }, { general: "Sc" }]],
	[
		"SM",
		[{ codePoints: [0x1b6b, 0x1b6c, 0x1b6d, 0x1b6e, 0x1b6f, 0x1b70, 0x1b71, 0x1b72, 0x1b73] }],
	],
	["SUB", [{ syllabic: "Consonant_Subjoined", notGeneral: "Lo" }]],
	[
		"V",
		[
			{ syllabic: "Vowel", notGeneral: "Lo" },
			{ syllabic: "Vowel_Dependent", notGeneral: "Lo" },
			{ syllabic: "Pure_Killer" },
		],
	],
	[
		"VM",
		[
			{ syllabic: "Bindu", notGeneral: "Lo" },
			{ syllabic: "Tone_Mark" },
			{ syllabic: "Cantillation_Mark" },
			{ syllabic: "Register_Shifter" },
			{ syllabic: "Visarga" },
		],
	],
	["VS", [{ codePoints: Array.from({ length: 16 }, (_, index) => 0xfe00 + index) }]],
	["WJ", [{ codePoints: [0x2060] }]],
	["ZWJ", [{ syllabic: "Joiner" }]],
	["ZWNJ", [{ syllabic: "Non_Joiner" }]],
	["O", [{ syllabic: "Other" }]],
];

/** The positional suffixes a category takes, by the positional categories that give each. */
const POSITIONAL_SUFFIXES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
	F: { Abv: ["Top"], Blw: ["Bottom"], Pst: ["Right"] },
	M: { Abv: ["Top"], Blw: ["Bottom"], Pst: ["Right"], Pre: ["Left"] },
	CM: { Abv: ["Top"], Blw: ["Bottom"] },
	V: {
		Abv: ["Top", "Top_And_Bottom", "Top_And_Bottom_And_Right", "Top_And_Right"],
		Blw: ["Bottom", "Overstruck", "Bottom_And_Right"],
		Pst: ["Right"],
		Pre: ["Left", "Top_And_Left", "Top_And_Left_And_Right", "Left_And_Right"],
	},
	VM: { Abv: ["Top"], Blw: ["Bottom", "Overstruck"], Pst: ["Right"], Pre: ["Left"] },
	SM: { Abv: ["Top"], Blw: ["Bottom"] },
};

/** Syllabic categories the USE specification assigns differently from the Unicode data. */
const SYLLABIC_OVERRIDES: ReadonlyMap<number, string> = new Map([
	[0x17dd, "Vowel_Dependent"],
	[0x1ce2, "Cantillation_Mark"],
	[0x1ce3, "Cantillation_Mark"],
	[0x1ce4, "Cantillation_Mark"],
	[0x1ce5, "Cantillation_Mark"],
	[0x1ce6, "Cantillation_Mark"],
	[0x1ce7, "Cantillation_Mark"],
	[0x1ce8, "Cantillation_Mark"],
	[0x1ced, "Tone_Mark"],
]);

/** Positional categories the USE specification assigns differently from the Unicode data. */
const POSITIONAL_OVERRIDES: ReadonlyMap<number, string> = new Map([
	[0x1b6c, "Bottom"],
	[0x0953, "Not_Applicable"],
	[0x0954, "Not_Applicable"],
	[0x103c, "Left"],
	[0xa926, "Top"],
	[0xa927, "Top"],
	[0xa928, "Top"],
	[0xa929, "Top"],
	[0xa92a, "Top"],
	[0x111ca, "Bottom"],
	[0x11300, "Top"],
	[0x1133c, "Bottom"],
	[0x1171e, "Left"],
	[0x1cf2, "Right"],
	[0x1cf3, "Right"],
	[0x1cf8, "Top"],
	[0x1cf9, "Top"],
]);

/**
 * Whether a character satisfies one classification rule.
 *
 * @param rule - The rule.
 * @param codePoint - The character.
 * @param syllabic - Its syllabic category.
 * @param general - Its general category.
 */
function matches(rule: Rule, codePoint: number, syllabic: string, general: string): boolean {
	if (rule.syllabic !== undefined && rule.syllabic !== syllabic) return false;
	if (rule.general !== undefined && rule.general !== general) return false;
	if (rule.notGeneral !== undefined && rule.notGeneral === general) return false;
	if (rule.codePoints !== undefined && !rule.codePoints.includes(codePoint)) return false;
	return rule.except?.includes(codePoint) !== true;
}

/**
 * A character's USE category: the class (`B`, `H`, `V`…) with its position suffix where the
 * class has one (`VPre`, `CMBlw`), `"O"` for other characters and `""` for none.
 *
 * @param codePoint - A code point.
 * @example useCategory(0x1b3e) // "VPre", Balinese vowel sign taling
 */
export function useCategory(codePoint: number): string {
	let syllabic = SYLLABIC_OVERRIDES.get(codePoint) ?? indicSyllabicCategory(codePoint);
	let general = generalCategory(codePoint);
	for (let [category, rules] of RULES) {
		if (!rules.some((rule) => matches(rule, codePoint, syllabic, general))) continue;
		let suffixes = POSITIONAL_SUFFIXES[category];
		if (suffixes === undefined) return category;
		let positional = POSITIONAL_OVERRIDES.get(codePoint) ?? indicPositionalCategory(codePoint);
		for (let [suffix, positions] of Object.entries(suffixes)) {
			if (positions.includes(positional)) return category + suffix;
		}
		return category;
	}
	return "";
}
