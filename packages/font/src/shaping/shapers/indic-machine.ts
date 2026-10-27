/**
 * The Indic syllable grammar: consonant, vowel, standalone, symbol and broken syllables
 * over the shaping categories of `indic-data.ts`. Every repetition is bounded, so no
 * syllable grows past a few dozen glyphs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Pattern, Syllable } from "./syllable-machine.js";

import { CATEGORIES } from "./indic-data.js";
import { SyllableMachine, choice, optional, repeat, sequence, symbol } from "./syllable-machine.js";

/**
 * A pattern matching one glyph of any of the given categories.
 *
 * @param names - Category names.
 */
function is(...names: (keyof typeof CATEGORIES)[]): Pattern {
	return symbol(...names.map((name) => 31 - Math.clz32(CATEGORIES[name])));
}

/** A consonant. */
const CONSONANT = is("C", "Ra");
/** Consonant modifiers: an optional register shifter, then up to two nuktas. */
const MODIFIERS = sequence(
	optional(optional(is("ZWNJ")), is("RS")),
	optional(is("N"), optional(is("N"))),
);
/** A joiner. */
const JOINER = is("ZWJ", "ZWNJ");
/** A virama or coeng. */
const HALANT = is("H", "Coeng");
/** A reph: Ra and virama, or an encoded repha. */
const REPH = choice(sequence(is("Ra"), is("H")), is("Repha"));
/** A consonant with its joiner and modifiers. */
const CONSONANT_GROUP = sequence(CONSONANT, optional(is("ZWJ")), optional(MODIFIERS));
/** ZWJ, virama, ZWJ, Ra: a requested rakar. */
const FORCED_RAKAR = sequence(is("ZWJ"), is("H"), is("ZWJ"), is("Ra"));
/** A matra with its joiners, nukta and trailing virama. */
const MATRA_GROUP = sequence(
	repeat(JOINER, 0, 3),
	is("M"),
	optional(is("N")),
	optional(choice(is("H"), FORCED_RAKAR)),
);
/** Syllable modifiers and cantillation marks. */
const SYLLABLE_TAIL = sequence(
	optional(optional(JOINER), is("SM"), optional(is("SM")), optional(is("ZWNJ"))),
	repeat(is("A"), 0, 3),
);
/** A virama with its joiners. */
const HALANT_GROUP = sequence(optional(JOINER), HALANT, optional(is("ZWJ"), optional(is("N"))));
/** A syllable-final virama, which may end in ZWNJ. */
const FINAL_HALANT_GROUP = choice(HALANT_GROUP, sequence(HALANT, is("ZWNJ")));
/** The syllable's end: a final virama or matras, then a coeng-subjoined consonant or vowel. */
const HALANT_OR_MATRA_GROUP = sequence(
	choice(FINAL_HALANT_GROUP, sequence(optional(HALANT, is("ZWJ")), repeat(MATRA_GROUP, 0, 4))),
	optional(is("Coeng"), choice(CONSONANT_GROUP, is("V"))),
);
/** Up to four conjoined consonants after the first, then a medial and the syllable's end. */
const CONJUNCT_TAIL = sequence(
	repeat(sequence(HALANT_GROUP, CONSONANT_GROUP), 0, 4),
	optional(is("CM")),
	HALANT_OR_MATRA_GROUP,
	SYLLABLE_TAIL,
);

/** The machine once built; the first run of Indic text builds it. */
const CACHE: { machine: SyllableMachine | null } = { machine: null };

/**
 * Splits a buffer into Indic syllables; glyphs outside any syllable come back in syllables
 * of type `null`.
 *
 * @param symbols - Each glyph's category bit index.
 */
export function indicSyllables(symbols: readonly number[]): Syllable[] {
	CACHE.machine ??= buildMachine();
	return CACHE.machine.match(symbols);
}

/** The Indic syllable machine, rules in priority order. */
function buildMachine(): SyllableMachine {
	return new SyllableMachine([
		[
			"consonant_syllable",
			sequence(
				optional(is("Repha")),
				repeat(sequence(CONSONANT_GROUP, HALANT_GROUP), 0, 4),
				CONSONANT_GROUP,
				optional(is("CM")),
				HALANT_OR_MATRA_GROUP,
				SYLLABLE_TAIL,
			),
		],
		[
			"vowel_syllable",
			sequence(optional(REPH), is("V"), optional(MODIFIERS), choice(is("ZWJ"), CONJUNCT_TAIL)),
		],
		[
			"standalone_cluster",
			sequence(
				choice(
					sequence(optional(is("Repha")), is("Placeholder")),
					sequence(optional(REPH), is("Dotted_Circle")),
				),
				optional(MODIFIERS),
				CONJUNCT_TAIL,
			),
		],
		["symbol_cluster", sequence(is("Symbol"), optional(is("N")), SYLLABLE_TAIL)],
		["broken_cluster", sequence(optional(REPH), optional(MODIFIERS), CONJUNCT_TAIL)],
	]);
}
