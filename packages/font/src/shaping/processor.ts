/**
 * What GSUB and GPOS processing share: choosing a script and language system, turning
 * feature tags into the lookups to run, walking the buffer under each lookup's flags, and
 * matching contextual and chaining contextual rules before running their nested lookups.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GlyphInfo } from "./glyph-info.js";
import type { Feature, LayoutTable, Lookup } from "./layout-table.js";
import type { ShapingFont } from "./shaping-font.js";

import { GlyphIterator } from "./glyph-iterator.js";
import {
	coverageIndex,
	feature,
	featureSubstitutions,
	glyphClass,
	languageSystem,
	lookup,
	scriptOffset,
} from "./layout-table.js";

/** Where one glyph sits, in font units: how far it moves the pen and how far it is drawn from the pen. */
export interface GlyphPosition {
	xAdvance: number;
	yAdvance: number;
	xOffset: number;
	yOffset: number;
}

/** A lookup to run and the features that asked for it; a glyph needs one of them enabled. */
export interface PlannedLookup {
	lookup: Lookup;
	features: string[];
}

/** A nested lookup a contextual rule runs at one position of its input sequence. */
interface LookupRecord {
	sequenceIndex: number;
	lookupIndex: number;
}

/** Scripts a font's default features are listed under, tried in this order when the text's script is absent. */
const DEFAULT_SCRIPTS = ["DFLT", "dflt", "latn"];

/** How deep contextual lookups may nest before a font is treated as looping. */
const MAX_NESTING = 64;

/** Lookup applications allowed per buffer glyph, so a hostile font cannot run forever. */
const OPERATIONS_PER_GLYPH = 1024;

/** How many times longer than its input a buffer may grow through multiple substitutions. */
export const MAX_GROWTH = 32;

/**
 * The script and language selection and lookup machinery of one GSUB or GPOS table.
 * Subclasses apply each subtable type; this class decides where and whether they run.
 */
export abstract class LayoutProcessor {
	readonly font: ShapingFont;
	readonly table: LayoutTable;
	/** The script tag selected from the table, `null` when it lists none of the candidates or defaults. */
	scriptTag: string | null = null;
	/** The language tag selected, `null` for the script's default language system. */
	languageTag: string | null = null;
	direction: "ltr" | "rtl" = "ltr";
	/** The features the selected language system enables, by tag. */
	features = new Map<string, Feature>();
	/** The tag of the language system's required feature, applied whatever the plan asks. */
	requiredFeature: string | null = null;
	/** The user's feature values; a number selects an alternate for GSUB type 3. */
	userFeatures = new Map<string, number>();
	glyphs: GlyphInfo[] = [];
	positions: GlyphPosition[] = [];
	iterator: GlyphIterator;
	/** The features of the lookup being applied. */
	currentFeatures: string[] = [];
	/** The largest the buffer may grow to. */
	maxLength = 0;

	#substitutions: Map<number, number>;
	#operations = 0;
	#depth = 0;

	/**
	 * @param font - The font being shaped.
	 * @param table - Its GSUB or GPOS table.
	 * @param coordinates - Normalized variation coordinates that pick feature variations;
	 *   the default instance when empty.
	 */
	constructor(font: ShapingFont, table: LayoutTable, coordinates: readonly number[] = []) {
		this.font = font;
		this.table = table;
		this.#substitutions = featureSubstitutions(table, coordinates);
		this.iterator = new GlyphIterator(font, []);
	}

	/**
	 * Selects the first candidate script the table lists, else its default script, and the
	 * language system for `language` within it, else the script's default one.
	 *
	 * @param scripts - OpenType script tags in order of preference.
	 * @param language - A language system tag, padded to four characters, or `null`.
	 * @param direction - The run's direction, for cursive attachment.
	 * @returns The script tag selected, `null` when the table has none to offer.
	 */
	selectScript(
		scripts: readonly string[],
		language: string | null,
		direction: "ltr" | "rtl",
	): string | null {
		this.direction = direction;
		this.features = new Map();
		this.requiredFeature = null;
		this.scriptTag = null;
		this.languageTag = null;
		let offset = 0;
		for (let tag of [...scripts, ...DEFAULT_SCRIPTS]) {
			offset = scriptOffset(this.table, tag);
			if (offset !== 0) {
				this.scriptTag = tag;
				break;
			}
		}
		if (offset === 0) return null;
		let system = languageSystem(this.table, offset, language);
		if (system === null) return this.scriptTag;
		this.languageTag = system.tag;
		for (let index of system.featureIndices) {
			let found = feature(this.table, index, this.#substitutions.get(index));
			if (found !== null && !this.features.has(found.tag)) this.features.set(found.tag, found);
		}
		if (system.required !== 0xffff) {
			let required = feature(this.table, system.required, this.#substitutions.get(system.required));
			if (required !== null) {
				this.requiredFeature = required.tag;
				this.features.set(required.tag, required);
			}
		}
		return this.scriptTag;
	}

	/**
	 * The lookups the given features run, each once in lookup list order, with every feature
	 * that asked for it; tags the language system lacks are skipped.
	 *
	 * @param tags - Feature tags.
	 */
	lookupsForFeatures(tags: Iterable<string>): PlannedLookup[] {
		let byIndex = new Map<number, PlannedLookup>();
		for (let tag of tags) {
			let found = this.features.get(tag);
			if (found === undefined) continue;
			for (let index of found.lookupIndices) {
				let planned = byIndex.get(index);
				if (planned !== undefined) {
					if (!planned.features.includes(tag)) planned.features.push(tag);
					continue;
				}
				let decoded = lookup(this.table, index);
				if (decoded !== null) byIndex.set(index, { lookup: decoded, features: [tag] });
			}
		}
		let planned = [...byIndex.values()];
		planned.sort((a, b) => a.lookup.index - b.lookup.index);
		return planned;
	}

	/**
	 * Runs the lookups of a set of features over the buffer.
	 *
	 * @param tags - Feature tags, applied together as one stage.
	 * @param glyphs - The buffer, changed in place.
	 * @param positions - The positions, for GPOS; parallel to `glyphs`.
	 */
	applyFeatures(tags: Iterable<string>, glyphs: GlyphInfo[], positions: GlyphPosition[] = []) {
		this.applyLookups(this.lookupsForFeatures(tags), glyphs, positions);
	}

	/**
	 * Runs lookups in order, each across the whole buffer before the next starts, on the
	 * glyphs that carry one of its features and that its flags do not ignore.
	 *
	 * @param lookups - What `lookupsForFeatures` planned.
	 * @param glyphs - The buffer, changed in place.
	 * @param positions - The positions, for GPOS.
	 */
	applyLookups(lookups: PlannedLookup[], glyphs: GlyphInfo[], positions: GlyphPosition[]) {
		this.glyphs = glyphs;
		this.positions = positions;
		this.iterator = new GlyphIterator(this.font, glyphs);
		this.maxLength = Math.max(glyphs.length * MAX_GROWTH, 256);
		this.#operations = Math.max(glyphs.length, 16) * OPERATIONS_PER_GLYPH;
		for (let planned of lookups) {
			this.currentFeatures = planned.features;
			let reverse = this.isReverseLookup(planned.lookup);
			let direction = reverse ? -1 : 1;
			let { flags, markFilteringSet } = planned.lookup;
			this.iterator.reset(flags, reverse ? glyphs.length - 1 : 0, markFilteringSet);
			while (this.iterator.index >= 0 && this.iterator.index < glyphs.length) {
				let glyph = this.iterator.current;
				if (glyph !== null && this.#eligible(glyph)) this.applyLookupSubtables(planned.lookup);
				if (this.#operations <= 0) return;
				this.iterator.move(direction);
			}
		}
	}

	/**
	 * Whether the current lookup applies to a glyph: one of its features is on and its flags
	 * keep the glyph.
	 *
	 * @param glyph - The glyph at the cursor.
	 */
	#eligible(glyph: GlyphInfo): boolean {
		if (this.iterator.shouldIgnore(glyph)) return false;
		return this.currentFeatures.some((tag) => glyph.features.has(tag));
	}

	/**
	 * Tries a lookup's subtables at the cursor until one applies.
	 *
	 * @param planned - The lookup.
	 * @returns Whether a subtable applied.
	 */
	applyLookupSubtables(planned: Lookup): boolean {
		for (let subtable of planned.subtables) {
			this.#operations--;
			if (this.#operations <= 0) return false;
			if (this.applySubtable(subtable.type, subtable.offset)) return true;
		}
		return false;
	}

	/**
	 * Applies one subtable at the cursor. On success the cursor is left on the last glyph the
	 * subtable consumed, so the walk resumes after it.
	 *
	 * @param type - The lookup type.
	 * @param offset - Absolute offset of the subtable.
	 * @returns Whether the subtable applied.
	 */
	abstract applySubtable(type: number, offset: number): boolean;

	/**
	 * Whether a lookup walks the buffer from the end; only GSUB reverse chaining does.
	 *
	 * @param _planned - The lookup.
	 */
	isReverseLookup(_planned: Lookup): boolean {
		return false;
	}

	/**
	 * The current user value of the lookup's feature: the alternate index GSUB type 3 picks
	 * (`1` for the first), `1` when the user gave none.
	 */
	featureValue(): number {
		for (let tag of this.currentFeatures) {
			let value = this.userFeatures.get(tag);
			if (value !== undefined) return value;
		}
		return 1;
	}

	/**
	 * Whether consecutive considered glyphs from `start` steps away match a sequence, leaving
	 * the cursor where it was.
	 *
	 * @param start - Steps from the cursor to the first glyph (`0` is the cursor itself).
	 * @param count - Sequence length.
	 * @param test - Whether the glyph matches the sequence item at `item`.
	 * @param matched - Receives each matched glyph's buffer index when given.
	 */
	match(
		start: number,
		count: number,
		test: (item: number, glyph: GlyphInfo) => boolean,
		matched?: number[],
	): boolean {
		let iterator = this.iterator;
		let origin = iterator.index;
		let glyph = start === 0 ? iterator.current : iterator.increment(start);
		let item = 0;
		while (item < count && glyph !== null && test(item, glyph)) {
			matched?.push(iterator.index);
			item++;
			if (item < count) glyph = iterator.next();
		}
		iterator.index = origin;
		return item === count;
	}

	/**
	 * Whether the considered glyphs before the cursor match a backtrack sequence, whose first
	 * item is the glyph right before it.
	 *
	 * @param count - Sequence length.
	 * @param test - Whether the glyph matches the sequence item at `item`.
	 */
	matchBacktrack(count: number, test: (item: number, glyph: GlyphInfo) => boolean): boolean {
		let iterator = this.iterator;
		let origin = iterator.index;
		let item = 0;
		while (item < count) {
			let glyph = iterator.previous();
			if (glyph === null || !test(item, glyph)) break;
			item++;
		}
		iterator.index = origin;
		return item === count;
	}

	/**
	 * Runs a contextual rule's nested lookups at their positions in the matched input, then
	 * leaves the cursor on the input's last glyph, so the walk never revisits the input or
	 * what the nested lookups produced.
	 *
	 * @param records - The rule's lookup records.
	 * @param inputLength - How many glyphs the input sequence matched.
	 */
	applyLookupRecords(records: LookupRecord[], inputLength: number): boolean {
		let iterator = this.iterator;
		let { flags, markFilteringSet } = iterator;
		let start = iterator.index;
		let end = iterator.peekIndex(inputLength - 1) + 1;
		if (this.#depth >= MAX_NESTING) return false;
		this.#depth++;
		let features = this.currentFeatures;
		for (let record of records) {
			if (record.sequenceIndex >= inputLength) continue;
			iterator.reset(flags, start, markFilteringSet);
			iterator.increment(record.sequenceIndex);
			let index = iterator.index;
			let nested = lookup(this.table, record.lookupIndex);
			if (nested === null || index < 0 || index >= this.glyphs.length) continue;
			iterator.reset(nested.flags, index, nested.markFilteringSet);
			let length = this.glyphs.length;
			this.applyLookupSubtables(nested);
			end = Math.max(end + this.glyphs.length - length, index);
		}
		this.currentFeatures = features;
		this.#depth--;
		iterator.reset(flags, end - 1, markFilteringSet);
		return true;
	}

	/**
	 * Reads lookup records (sequence index, lookup index pairs).
	 *
	 * @param offset - Absolute offset of the first record.
	 * @param count - How many.
	 */
	readLookupRecords(offset: number, count: number): LookupRecord[] {
		let { reader } = this.font;
		let records: LookupRecord[] = [];
		for (let index = 0; index < count; index++) {
			let record = offset + index * 4;
			records.push({ sequenceIndex: reader.u16(record), lookupIndex: reader.u16(record + 2) });
		}
		return records;
	}

	/**
	 * Applies a contextual subtable (GSUB 5, GPOS 7) in any of its three formats.
	 *
	 * @param offset - Absolute offset of the subtable.
	 */
	applyContext(offset: number): boolean {
		let { reader } = this.font;
		let glyph = this.iterator.current;
		if (glyph === null) return false;
		let format = reader.u16(offset);
		if (format === 3) {
			let count = reader.u16(offset + 2);
			let lookups = reader.u16(offset + 4);
			let coverages = offset + 6;
			let matches = this.match(0, count, (item, candidate) => {
				let coverage = offset + reader.u16(coverages + item * 2);
				return coverageIndex(reader, coverage, candidate.glyph) >= 0;
			});
			if (!matches) return false;
			return this.applyLookupRecords(this.readLookupRecords(coverages + count * 2, lookups), count);
		}
		if (format !== 1 && format !== 2) return false;
		let covered = coverageIndex(reader, offset + reader.u16(offset + 2), glyph.glyph);
		if (covered === -1) return false;
		let classDef = format === 2 ? offset + reader.u16(offset + 4) : 0;
		let sets = format === 2 ? offset + 6 : offset + 4;
		let setIndex = format === 2 ? glyphClass(reader, classDef, glyph.glyph) : covered;
		if (setIndex >= reader.u16(sets)) return false;
		let setOffset = reader.u16(sets + 2 + setIndex * 2);
		if (setOffset === 0) return false;
		let set = offset + setOffset;
		let rules = reader.u16(set);
		for (let index = 0; index < rules; index++) {
			let rule = set + reader.u16(set + 2 + index * 2);
			let count = reader.u16(rule);
			let lookups = reader.u16(rule + 2);
			let input = rule + 4;
			let matches = this.match(1, count - 1, (item, candidate) => {
				let value = reader.u16(input + item * 2);
				if (format === 1) return candidate.glyph === value;
				return glyphClass(reader, classDef, candidate.glyph) === value;
			});
			if (count === 0 || !matches) continue;
			let records = this.readLookupRecords(input + (count - 1) * 2, lookups);
			return this.applyLookupRecords(records, count);
		}
		return false;
	}

	/**
	 * Applies a chaining contextual subtable (GSUB 6, GPOS 8) in any of its three formats.
	 *
	 * @param offset - Absolute offset of the subtable.
	 */
	applyChainingContext(offset: number): boolean {
		let { reader } = this.font;
		let glyph = this.iterator.current;
		if (glyph === null) return false;
		let format = reader.u16(offset);
		if (format === 3) return this.#applyChainingFormat3(offset);
		if (format !== 1 && format !== 2) return false;
		let covered = coverageIndex(reader, offset + reader.u16(offset + 2), glyph.glyph);
		if (covered === -1) return false;
		let backtrackDef = format === 2 ? offset + reader.u16(offset + 4) : 0;
		let inputDef = format === 2 ? offset + reader.u16(offset + 6) : 0;
		let lookaheadDef = format === 2 ? offset + reader.u16(offset + 8) : 0;
		let sets = format === 2 ? offset + 10 : offset + 4;
		let setIndex = format === 2 ? glyphClass(reader, inputDef, glyph.glyph) : covered;
		if (setIndex >= reader.u16(sets)) return false;
		let setOffset = reader.u16(sets + 2 + setIndex * 2);
		if (setOffset === 0) return false;
		let set = offset + setOffset;
		let rules = reader.u16(set);
		let matcher = (classDef: number, base: number) => (item: number, candidate: GlyphInfo) => {
			let value = reader.u16(base + item * 2);
			if (format === 1) return candidate.glyph === value;
			return glyphClass(reader, classDef, candidate.glyph) === value;
		};
		for (let index = 0; index < rules; index++) {
			let rule = set + reader.u16(set + 2 + index * 2);
			let backtrack = reader.u16(rule);
			let inputAt = rule + 2 + backtrack * 2;
			let input = reader.u16(inputAt);
			let lookaheadAt = inputAt + 2 + Math.max(input - 1, 0) * 2;
			let lookahead = reader.u16(lookaheadAt);
			let recordsAt = lookaheadAt + 2 + lookahead * 2;
			if (input === 0) continue;
			if (!this.matchBacktrack(backtrack, matcher(backtrackDef, rule + 2))) continue;
			if (!this.match(1, input - 1, matcher(inputDef, inputAt + 2))) continue;
			if (!this.match(input, lookahead, matcher(lookaheadDef, lookaheadAt + 2))) continue;
			let records = this.readLookupRecords(recordsAt + 2, reader.u16(recordsAt));
			return this.applyLookupRecords(records, input);
		}
		return false;
	}

	/**
	 * Chaining context format 3: one coverage table per backtrack, input and lookahead glyph.
	 *
	 * @param offset - Absolute offset of the subtable.
	 */
	#applyChainingFormat3(offset: number): boolean {
		let { reader } = this.font;
		let backtrack = reader.u16(offset + 2);
		let inputAt = offset + 4 + backtrack * 2;
		let input = reader.u16(inputAt);
		let lookaheadAt = inputAt + 2 + input * 2;
		let lookahead = reader.u16(lookaheadAt);
		let recordsAt = lookaheadAt + 2 + lookahead * 2;
		let covered = (base: number) => (item: number, candidate: GlyphInfo) => {
			let coverage = offset + reader.u16(base + item * 2);
			return coverageIndex(reader, coverage, candidate.glyph) >= 0;
		};
		if (input === 0) return false;
		if (!this.match(0, input, covered(inputAt + 2))) return false;
		if (!this.matchBacktrack(backtrack, covered(offset + 4))) return false;
		if (!this.match(input, lookahead, covered(lookaheadAt + 2))) return false;
		let records = this.readLookupRecords(recordsAt + 2, reader.u16(recordsAt));
		return this.applyLookupRecords(records, input);
	}
}
