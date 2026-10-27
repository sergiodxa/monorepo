/**
 * The Universal Shaping Engine cluster grammar: independent, virama-terminated, standard,
 * numeral, symbol and broken clusters over USE categories. Categories the grammar does not
 * name end a cluster, so the glyphs carrying them stay outside every cluster.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Pattern, Syllable } from "./syllable-machine.js";

import { SyllableMachine, choice, many, optional, sequence, symbol } from "./syllable-machine.js";

/** The categories the grammar reads, each numbered by its index. */
const SYMBOLS = [
	"B",
	"GB",
	"R",
	"VS",
	"H",
	"SUB",
	"CMAbv",
	"CMBlw",
	"MPre",
	"MAbv",
	"MBlw",
	"MPst",
	"VPre",
	"VAbv",
	"VBlw",
	"VPst",
	"VMPre",
	"VMAbv",
	"VMBlw",
	"VMPst",
	"FAbv",
	"FBlw",
	"FPst",
	"FM",
	"N",
	"HN",
	"S",
	"SMAbv",
	"SMBlw",
	"IND",
	"O",
	"WJ",
];

/**
 * The machine's symbol for a USE category, `-1` for a category no cluster contains.
 *
 * @param category - A USE category.
 */
export function useSymbol(category: string): number {
	return SYMBOLS.indexOf(category);
}

/**
 * A pattern matching one glyph of any of the given categories.
 *
 * @param names - USE categories.
 */
function is(...names: string[]): Pattern {
	return symbol(...names.map(useSymbol));
}

/** The machine once built; the first run of USE text builds it. */
const CACHE: { machine: SyllableMachine | null } = { machine: null };

/**
 * Splits a buffer into USE clusters; glyphs outside any cluster come back in syllables of
 * type `null`.
 *
 * @param symbols - Each glyph's symbol from `useSymbol`.
 */
export function useSyllables(symbols: readonly number[]): Syllable[] {
	CACHE.machine ??= buildMachine();
	return CACHE.machine.match(symbols);
}

/** The USE cluster machine, rules in priority order. */
function buildMachine(): SyllableMachine {
	let consonantModifiers = sequence(
		many(is("CMAbv")),
		many(is("CMBlw")),
		many(
			choice(sequence(is("H"), is("B")), is("SUB")),
			optional(is("VS")),
			optional(is("CMAbv")),
			many(is("CMBlw")),
		),
	);
	let medialConsonants = sequence(
		optional(is("MPre")),
		optional(is("MAbv")),
		optional(is("MBlw")),
		optional(is("MPst")),
	);
	let dependentVowels = sequence(
		many(is("VPre")),
		many(is("VAbv")),
		many(is("VBlw")),
		many(is("VPst")),
	);
	let vowelModifiers = sequence(
		many(is("VMPre")),
		many(is("VMAbv")),
		many(is("VMBlw")),
		many(is("VMPst")),
	);
	let finalConsonants = sequence(
		many(is("FAbv")),
		many(is("FBlw")),
		many(is("FPst")),
		optional(is("FM")),
	);
	let clusterTail = sequence(medialConsonants, dependentVowels, vowelModifiers, finalConsonants);
	let base = sequence(optional(is("R")), is("B", "GB"), optional(is("VS")), consonantModifiers);
	let numeral = sequence(is("N"), optional(is("VS")), many(is("HN"), is("N"), optional(is("VS"))));
	return new SyllableMachine([
		["independent_cluster", sequence(is("IND", "O", "WJ"), optional(is("VS")))],
		["virama_terminated_cluster", sequence(base, is("H"))],
		["standard_cluster", sequence(base, clusterTail)],
		["number_joiner_terminated_cluster", sequence(numeral, is("HN"))],
		["numeral_cluster", numeral],
		["symbol_cluster", sequence(is("S"), optional(is("VS")), many(is("SMAbv")), many(is("SMBlw")))],
		["broken_cluster", sequence(optional(is("R")), consonantModifiers, clusterTail)],
	]);
}
