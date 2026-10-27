/**
 * Tests for each `morx` subtable type through `shape()`, with hand-built tables added to a
 * small font that has no layout tables: noncontextual, rearrangement, contextual, ligature
 * and insertion subtables, chain feature flags, `feat` exclusivity and hostile tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../../font.js";

import { parseFont } from "../../index.js";
import { availableFeatures, shape } from "../index.js";

/** A font without GSUB, GPOS or `morx`; `b a q y x` map to glyphs 1 to 5. */
const BASE = readFileSync(
	new URL(
		"../../fixtures/FontkitMarkFallbackTest/FontkitMarkFallbackTest-Italic.ttf",
		import.meta.url,
	),
);

/** Entry flags the tests use. */
const FLAG = {
	MARK_FIRST: 0x8000,
	SET_MARK: 0x8000,
	SET_COMPONENT: 0x8000,
	DONT_ADVANCE: 0x4000,
	MARK_LAST: 0x2000,
	PERFORM_ACTION: 0x2000,
	CURRENT_INSERT_BEFORE: 0x0800,
	MARKED_INSERT_BEFORE: 0x0400,
};

/**
 * Big-endian 16-bit words as bytes.
 *
 * @param values - The words.
 */
function u16(...values: number[]): number[] {
	return values.flatMap((value) => [(value >> 8) & 0xff, value & 0xff]);
}

/**
 * Big-endian 32-bit words as bytes.
 *
 * @param values - The words.
 */
function u32(...values: number[]): number[] {
	return values.flatMap((value) => [...u16(value >>> 16), ...u16(value & 0xffff)]);
}

/**
 * A format 6 lookup table mapping glyphs to values.
 *
 * @param pairs - Glyph and value pairs, sorted by glyph.
 */
function singleLookup(pairs: [number, number][]): number[] {
	return [
		...u16(6, 4, pairs.length, 0, 0, 0),
		...pairs.flatMap(([glyph, value]) => u16(glyph, value)),
	];
}

/** What an extended state table subtable is made of. */
interface StateTableParts {
	/** Glyph classes, a format 6 lookup's pairs; class 1 is every other glyph. */
	classes: [number, number][];
	classCount: number;
	/** One row of entry indices per state. */
	states: number[][];
	/** Each entry's words: new state, flags, then the type's own data. */
	entries: number[][];
	/** Tables after the state table; the header holds each one's offset. */
	tables?: number[][];
}

/**
 * An extended state table subtable body: its header, class lookup, state array, entry
 * table, then the type's own tables, each offset relative to the body.
 *
 * @param parts - The pieces.
 */
function stateTable(parts: StateTableParts): number[] {
	let tables = parts.tables ?? [];
	let headerSize = 16 + tables.length * 4;
	let classTable = singleLookup(parts.classes);
	let stateArray = parts.states.flatMap((row) => u16(...row));
	let entryTable = parts.entries.flatMap((entry) => u16(...entry));
	let offsets: number[] = [];
	let at = headerSize;
	for (let piece of [classTable, stateArray, entryTable, ...tables]) {
		offsets.push(at);
		at += piece.length;
	}
	return [
		...u32(parts.classCount, ...offsets),
		...classTable,
		...stateArray,
		...entryTable,
		...tables.flat(),
	];
}

/** One subtable of a test chain. */
interface SubtableParts {
	type: number;
	body: number[];
	/** @default 1 */
	flags?: number;
	/** @default 0 */
	coverage?: number;
}

/** A test chain. */
interface ChainParts {
	/** @default 1 */
	defaultFlags?: number;
	/** Feature entries: type, setting, enable flags, disable flags. */
	features?: [number, number, number, number][];
	subtables: SubtableParts[];
}

/**
 * A `morx` table of one chain.
 *
 * @param chain - The chain.
 * @param version - The table version.
 */
function morx(chain: ChainParts, version = 2): number[] {
	let features = (chain.features ?? []).flatMap(([type, setting, enable, disable]) => [
		...u16(type, setting),
		...u32(enable, disable),
	]);
	let subtables = chain.subtables.flatMap((subtable) => {
		let coverage = ((subtable.coverage ?? 0) << 24) | subtable.type;
		return [...u32(12 + subtable.body.length, coverage, subtable.flags ?? 1), ...subtable.body];
	});
	let length = 16 + features.length + subtables.length;
	let header = u32(chain.defaultFlags ?? 1, length, features.length / 12, chain.subtables.length);
	return [...u16(version, 0), ...u32(1), ...header, ...features, ...subtables];
}

/**
 * The test font with extra tables added to its table directory.
 *
 * @param extra - Table bytes by tag.
 */
function fontWith(extra: Record<string, number[]>): Font {
	let view = new DataView(BASE.buffer, BASE.byteOffset, BASE.byteLength);
	let count = view.getUint16(4);
	let tables = new Map<string, Uint8Array>();
	for (let index = 0; index < count; index++) {
		let record = 12 + index * 16;
		let tag = String.fromCharCode(...BASE.subarray(record, record + 4));
		let offset = view.getUint32(record + 8);
		tables.set(tag, BASE.subarray(offset, offset + view.getUint32(record + 12)));
	}
	for (let [tag, bytes] of Object.entries(extra)) tables.set(tag, Uint8Array.from(bytes));
	let tags = [...tables.keys()].sort();
	let size = 12 + tags.length * 16;
	for (let tag of tags) size += ((tables.get(tag)?.length ?? 0) + 3) & ~3;
	let bytes = new Uint8Array(size);
	let out = new DataView(bytes.buffer);
	out.setUint32(0, 0x00010000);
	out.setUint16(4, tags.length);
	let at = 12 + tags.length * 16;
	tags.forEach((tag, index) => {
		let table = tables.get(tag) ?? new Uint8Array();
		let record = 12 + index * 16;
		for (let char = 0; char < 4; char++) out.setUint8(record + char, tag.charCodeAt(char));
		out.setUint32(record + 8, at);
		out.setUint32(record + 12, table.length);
		bytes.set(table, at);
		at += (table.length + 3) & ~3;
	});
	return unwrap(parseFont(bytes));
}

/**
 * The glyph ids a run shapes to.
 *
 * @param font - The font.
 * @param text - The run.
 * @param features - The `features` option.
 */
function ids(font: Font, text: string, features?: Record<string, boolean>): number[] {
	return shape(font, text, { features }).glyphs.map((glyph) => glyph.glyph);
}

/**
 * A state row of six classes going to entry 0, except one class.
 *
 * @param glyphClass - The class with its own entry.
 * @param entry - That class's entry index.
 */
function row(glyphClass: number, entry: number): number[] {
	return [0, 1, 2, 3, 4, 5].map((index) => (index === glyphClass ? entry : 0));
}

describe("morx noncontextual subtables", () => {
	test("replaces every glyph its lookup covers", () => {
		let font = fontWith({ morx: morx({ subtables: [{ type: 4, body: singleLookup([[2, 3]]) }] }) });
		expect(ids(font, "ab")).toEqual([3, 1]);
	});

	test("runs only the subtables the chain's flags select", () => {
		let font = fontWith({
			morx: morx({ subtables: [{ type: 4, body: singleLookup([[2, 3]]), flags: 2 }] }),
		});
		expect(ids(font, "ab")).toEqual([2, 1]);
	});

	test("skips vertical-only subtables and reads version 3 tables", () => {
		let vertical = { type: 4, body: singleLookup([[2, 3]]), coverage: 0x80 };
		expect(ids(fontWith({ morx: morx({ subtables: [vertical] }) }), "a")).toEqual([2]);
		let any = { ...vertical, coverage: 0xa0 };
		expect(ids(fontWith({ morx: morx({ subtables: [any] }, 3) }), "a")).toEqual([3]);
	});
});

describe("morx rearrangement subtables", () => {
	/**
	 * A rearrangement subtable that marks `a` as first and `q` as last and applies `verb`.
	 *
	 * @param verb - The rearrangement verb.
	 */
	let rearrangement = (verb: number) =>
		stateTable({
			classes: [
				[2, 4],
				[3, 5],
			],
			classCount: 6,
			states: [
				[0, 0, 0, 0, 1, 0],
				[0, 0, 0, 0, 1, 0],
				[0, 3, 0, 0, 1, 2],
			],
			entries: [
				[0, 0],
				[2, FLAG.MARK_FIRST],
				[0, FLAG.MARK_LAST | verb],
				[2, 0],
			],
		});

	test("moves the first glyph of the range after the last (Ax => xA)", () => {
		let font = fontWith({ morx: morx({ subtables: [{ type: 0, body: rearrangement(1) }] }) });
		expect(ids(font, "abq")).toEqual([1, 3, 2]);
		expect(ids(font, "ab")).toEqual([2, 1]);
	});

	test("swaps the ends of the range (AxD => DxA)", () => {
		let font = fontWith({ morx: morx({ subtables: [{ type: 0, body: rearrangement(3) }] }) });
		expect(ids(font, "abbq")).toEqual([3, 1, 1, 2]);
	});

	test("reverses the two glyphs it moves (ABx => xBA)", () => {
		let font = fontWith({ morx: morx({ subtables: [{ type: 0, body: rearrangement(5) }] }) });
		expect(ids(font, "abyq")).toEqual([4, 3, 1, 2]);
	});
});

describe("morx contextual subtables", () => {
	let contextual = stateTable({
		classes: [
			[2, 4],
			[3, 5],
		],
		classCount: 6,
		states: [row(4, 1), row(4, 1), [0, 3, 0, 0, 1, 2]],
		entries: [
			[0, 0, 0xffff, 0xffff],
			[2, FLAG.SET_MARK, 0xffff, 0xffff],
			[0, 0, 0, 1],
			[2, 0, 0xffff, 0xffff],
		],
		tables: [[...u32(8, 16), ...u16(8, 2, 1, 5), ...singleLookup([[3, 4]])]],
	});

	test("replaces the marked and the current glyph through their lookups", () => {
		let font = fontWith({ morx: morx({ subtables: [{ type: 1, body: contextual }] }) });
		expect(ids(font, "aq")).toEqual([5, 4]);
		expect(ids(font, "abq")).toEqual([5, 1, 4]);
		expect(ids(font, "qa")).toEqual([3, 2]);
	});
});

describe("morx ligature subtables", () => {
	let ligature = stateTable({
		classes: [
			[1, 5],
			[2, 4],
		],
		classCount: 6,
		states: [row(4, 1), row(4, 1), [0, 0, 0, 0, 1, 2]],
		entries: [
			[0, 0, 0],
			[2, FLAG.SET_COMPONENT, 0],
			[0, FLAG.SET_COMPONENT | FLAG.PERFORM_ACTION, 0],
		],
		tables: [u32(0, 0x80000000), u16(0, 1, 0), u16(0, 9)],
	});

	test("replaces the components with the ligature, which draws all their characters", () => {
		let font = fontWith({ morx: morx({ subtables: [{ type: 2, body: ligature }] }) });
		let { glyphs } = shape(font, "xab");
		expect(glyphs.map((glyph) => glyph.glyph)).toEqual([5, 9]);
		expect(glyphs[1]?.codePoints).toEqual([0x61, 0x62]);
		expect(glyphs[1]?.cluster).toBe(1);
		expect(ids(font, "ba")).toEqual([1, 2]);
	});

	test("turns a ligature off through its chain's off setting", () => {
		let font = fontWith({
			morx: morx({
				features: [
					[1, 2, 1, 0xffffffff],
					[1, 3, 0, 0xfffffffe],
				],
				subtables: [{ type: 2, body: ligature }],
			}),
		});
		expect(ids(font, "ab")).toEqual([9]);
		expect(ids(font, "ab", { liga: false })).toEqual([2, 1]);
		expect(availableFeatures(font)).toEqual(["liga"]);
	});
});

describe("morx insertion subtables", () => {
	/**
	 * An insertion subtable that marks `a`, and on `q` inserts two glyphs at the current glyph
	 * and one at the mark.
	 *
	 * @param current - Flags for the current insertion.
	 * @param marked - Flags for the marked insertion, `null` for none.
	 */
	let insertion = (current: number, marked: number | null) =>
		stateTable({
			classes: [
				[2, 5],
				[3, 4],
			],
			classCount: 6,
			states: [
				[0, 0, 0, 0, 1, 2],
				[0, 0, 0, 0, 1, 2],
			],
			entries: [
				[0, 0, 0xffff, 0xffff],
				[
					0,
					current | (2 << 5) | (marked === null ? 0 : marked | 1),
					0,
					marked === null ? 0xffff : 2,
				],
				[0, FLAG.SET_MARK, 0xffff, 0xffff],
			],
			tables: [u16(18, 19, 25)],
		});

	test("inserts glyphs after the current glyph", () => {
		let font = fontWith({ morx: morx({ subtables: [{ type: 5, body: insertion(0, null) }] }) });
		let { glyphs } = shape(font, "qb");
		expect(glyphs.map((glyph) => glyph.glyph)).toEqual([3, 18, 19, 1]);
		expect(glyphs.map((glyph) => glyph.cluster)).toEqual([0, 0, 0, 1]);
	});

	test("inserts glyphs before the current glyph", () => {
		let body = insertion(FLAG.CURRENT_INSERT_BEFORE, null);
		let font = fontWith({ morx: morx({ subtables: [{ type: 5, body }] }) });
		expect(ids(font, "bqq")).toEqual([1, 18, 19, 3, 18, 19, 3]);
	});

	test("inserts glyphs at the marked glyph too", () => {
		let body = insertion(0, FLAG.MARKED_INSERT_BEFORE);
		let font = fontWith({ morx: morx({ subtables: [{ type: 5, body }] }) });
		expect(ids(font, "abq")).toEqual([25, 2, 1, 3, 18, 19]);
	});

	test("ends when an entry never advances", () => {
		let body = insertion(FLAG.DONT_ADVANCE, null);
		let font = fontWith({ morx: morx({ subtables: [{ type: 5, body }] }) });
		let { glyphs } = shape(font, "q");
		expect(glyphs.length).toBeGreaterThan(1);
		expect(glyphs.length).toBeLessThanOrEqual(256);
	});
});

describe("morx feature selection", () => {
	let swap = (from: number, to: number, flags: number) => ({
		type: 4,
		body: singleLookup([[from, to]]),
		flags,
	});

	test("turns an exclusive feature off by selecting the default setting `feat` names", () => {
		let feat = [
			...u32(0x10000),
			...u16(1, 0, 0, 0),
			...u16(10, 3),
			...u32(24),
			...u16(0xc000, 256),
			...u16(0, 257, 1, 258, 2, 259),
		];
		/**
		 * The font with a vertical position chain whose defaults select `defaultFlags`.
		 *
		 * @param defaultFlags - The chain's default flags.
		 */
		let fontFor = (defaultFlags: number) =>
			fontWith({
				feat,
				morx: morx({
					defaultFlags,
					features: [
						[10, 0, 0, 0xfffffffc],
						[10, 1, 1, 0xfffffffc],
						[10, 2, 2, 0xfffffffc],
					],
					subtables: [swap(2, 3, 1), swap(2, 4, 2)],
				}),
			});
		let normal = fontFor(0);
		expect(ids(normal, "a")).toEqual([2]);
		expect(ids(normal, "a", { sups: true })).toEqual([3]);
		expect(ids(normal, "a", { subs: true })).toEqual([4]);
		expect(ids(normal, "a", { sups: true, subs: false })).toEqual([3]);
		expect(ids(normal, "a", { subs: true, sups: false })).toEqual([4]);
		expect(availableFeatures(normal)).toEqual(["sups", "subs"]);
		let superior = fontFor(1);
		expect(ids(superior, "a")).toEqual([3]);
		expect(ids(superior, "a", { sups: false })).toEqual([2]);
	});

	test("reverses right-to-left runs before the chains run, keeping them in visual order", () => {
		let font = fontWith({ morx: morx({ subtables: [swap(2, 3, 1)] }) });
		expect(ids(font, "ab")).toEqual([3, 1]);
		expect(shape(font, "ab", { direction: "rtl" }).glyphs.map((glyph) => glyph.glyph)).toEqual([
			1, 3,
		]);
	});

	test("survives truncated and hostile tables", () => {
		let full = morx({ subtables: [{ type: 2, body: [...u32(0xffff, 0, 0, 0)] }] });
		for (let length = 0; length < full.length; length += 3) {
			let font = fontWith({ morx: full.slice(0, length) });
			expect(shape(font, "abq").glyphs.length).toBeGreaterThan(0);
		}
		let looping = stateTable({
			classes: [[2, 4]],
			classCount: 6,
			states: [row(4, 1), row(4, 1)],
			entries: [
				[0, 0],
				[0, FLAG.DONT_ADVANCE | 3],
			],
		});
		let font = fontWith({ morx: morx({ subtables: [{ type: 0, body: looping }] }) });
		expect(ids(font, "ab")).toHaveLength(2);
	});
});
