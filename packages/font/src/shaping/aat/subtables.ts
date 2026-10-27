/**
 * The `morx` subtable processors: the extended state machine that drives rearrangement,
 * contextual, ligature and insertion subtables glyph by glyph, and the noncontextual pass.
 * A glyph ligatures or substitutions delete is marked and removed once every chain has run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Reader } from "../../reader.js";
import type { ShapingFont } from "../shaping-font.js";

import { GlyphInfo } from "../glyph-info.js";
import { MAX_GROWTH } from "../processor.js";

import type { MorxSubtable } from "./morx.js";

import { aatLookup } from "./lookup.js";

/** The glyph id a deleted glyph carries until the buffer is compacted. */
export const DELETED_GLYPH = 0xffff;

/** Subtable types. */
const TYPE = { REARRANGEMENT: 0, CONTEXTUAL: 1, LIGATURE: 2, NONCONTEXTUAL: 4, INSERTION: 5 };

/** Predefined glyph classes of every state table. */
const CLASS = { END_OF_TEXT: 0, OUT_OF_BOUNDS: 1, DELETED_GLYPH: 2 };

/** Entry flags; `DONT_ADVANCE` is shared, the rest belong to one subtable type. */
const FLAG = {
	DONT_ADVANCE: 0x4000,
	MARK_FIRST: 0x8000,
	MARK_LAST: 0x2000,
	VERB: 0x000f,
	SET_MARK: 0x8000,
	SET_COMPONENT: 0x8000,
	PERFORM_ACTION: 0x2000,
	CURRENT_INSERT_BEFORE: 0x0800,
	MARKED_INSERT_BEFORE: 0x0400,
	CURRENT_INSERT_COUNT: 0x03e0,
	MARKED_INSERT_COUNT: 0x001f,
};

/** Ligature action bits. */
const ACTION = { LAST: 0x80000000, STORE: 0x40000000 };

/** Bytes of per-entry data after `newState` and `flags`, by subtable type. */
const ENTRY_DATA = new Map([
	[TYPE.REARRANGEMENT, 0],
	[TYPE.CONTEXTUAL, 4],
	[TYPE.LIGATURE, 2],
	[TYPE.INSERTION, 4],
]);

/**
 * How many glyphs before and after the marked point each rearrangement verb moves, with
 * `3` for two glyphs that also swap places (`AxD => DxA` is `0x11`, `ABx => xBA` is `0x30`).
 */
const VERBS = [
	0x00, 0x10, 0x01, 0x11, 0x20, 0x30, 0x02, 0x03, 0x12, 0x13, 0x21, 0x31, 0x22, 0x32, 0x23, 0x33,
];

/** Glyphs a ligature subtable remembers as components; older ones are forgotten. */
const MAX_COMPONENTS = 64;

/** State machine steps allowed per buffer glyph, so a font that never advances still ends. */
const STEPS_PER_GLYPH = 256;

/** One located state table entry. */
interface Entry {
	/** Absolute offset of the entry, whose per-type data starts 4 bytes in. */
	offset: number;
	flags: number;
}

/** Runs `morx` subtables over one buffer. */
export class MorxProcessor {
	readonly font: ShapingFont;
	readonly glyphs: GlyphInfo[];
	#reader: Reader;
	#numGlyphs: number;
	#maxLength: number;
	#subtable: MorxSubtable | null = null;
	/** The marked glyph of a contextual or insertion subtable, `null` until one is marked. */
	#mark: number | null = null;
	/** Rearrangement's marked range, `end` exclusive. */
	#first = 0;
	#last = 0;
	#components: number[] = [];

	/**
	 * @param font - The shaping view.
	 * @param glyphs - The buffer, changed in place.
	 */
	constructor(font: ShapingFont, glyphs: GlyphInfo[]) {
		this.font = font;
		this.glyphs = glyphs;
		this.#reader = font.reader;
		this.#numGlyphs = font.data.numGlyphs;
		this.#maxLength = Math.max(glyphs.length * MAX_GROWTH, 256);
	}

	/**
	 * Runs one subtable over the buffer.
	 *
	 * @param subtable - The subtable.
	 * @param reverse - Whether its state machine walks from the end.
	 */
	run(subtable: MorxSubtable, reverse: boolean) {
		this.#subtable = subtable;
		this.#mark = null;
		this.#first = 0;
		this.#last = 0;
		this.#components = [];
		if (subtable.type === TYPE.NONCONTEXTUAL) {
			this.#noncontextual(subtable.body);
			return;
		}
		if (ENTRY_DATA.has(subtable.type)) this.#drive(subtable, reverse);
	}

	/** Removes the glyphs marked deleted. */
	removeDeleted() {
		for (let index = this.glyphs.length - 1; index >= 0; index--) {
			if (this.glyphs[index]?.glyph === DELETED_GLYPH) this.glyphs.splice(index, 1);
		}
	}

	/**
	 * The extended state machine: classifies each glyph, follows the entry for the current
	 * state and class, lets the subtable act on it, and advances unless the entry says not to.
	 * End of text and deleted glyphs only change state.
	 *
	 * @param subtable - The subtable.
	 * @param reverse - Whether to walk from the end.
	 */
	#drive(subtable: MorxSubtable, reverse: boolean) {
		let reader = this.#reader;
		let header = subtable.body;
		let classCount = reader.u32(header);
		let classTable = header + reader.u32(header + 4);
		let stateArray = header + reader.u32(header + 8);
		let entryTable = header + reader.u32(header + 12);
		let entrySize = 4 + (ENTRY_DATA.get(subtable.type) ?? 0);
		if (classCount < 4 || classCount > 0xffff) return;
		let direction = reverse ? -1 : 1;
		let index = reverse ? this.glyphs.length - 1 : 0;
		let state = 0;
		let steps = Math.max(this.glyphs.length + 1, 16) * STEPS_PER_GLYPH;
		while (index >= -1 && index <= this.glyphs.length && steps-- > 0) {
			let glyph = this.glyphs[index];
			let glyphClass = CLASS.END_OF_TEXT;
			if (glyph !== undefined && glyph.glyph === DELETED_GLYPH) glyphClass = CLASS.DELETED_GLYPH;
			else if (glyph !== undefined) {
				glyphClass = aatLookup(reader, classTable, glyph.glyph, this.#numGlyphs) ?? 1;
				if (glyphClass >= classCount) glyphClass = CLASS.OUT_OF_BOUNDS;
			}
			let entryIndex = reader.u16(stateArray + (state * classCount + glyphClass) * 2);
			let offset = entryTable + entryIndex * entrySize;
			let entry = { offset, flags: reader.u16(offset + 2) };
			state = reader.u16(offset);
			let advance = true;
			if (glyphClass !== CLASS.END_OF_TEXT && glyphClass !== CLASS.DELETED_GLYPH) {
				index = this.#transition(subtable.type, entry, index);
				advance = (entry.flags & FLAG.DONT_ADVANCE) === 0;
			}
			if (glyphClass === CLASS.END_OF_TEXT) break;
			if (advance) index += direction;
		}
	}

	/**
	 * Acts on the glyph at `index` for one entry.
	 *
	 * @param type - The subtable type.
	 * @param entry - The entry followed.
	 * @param index - Buffer index of the current glyph.
	 * @returns Where the machine continues from: the current glyph's index, moved past
	 *   inserted glyphs.
	 */
	#transition(type: number, entry: Entry, index: number): number {
		switch (type) {
			case TYPE.REARRANGEMENT:
				this.#rearrange(entry, index);
				return index;
			case TYPE.CONTEXTUAL:
				this.#contextual(entry, index);
				return index;
			case TYPE.LIGATURE:
				this.#ligature(entry, index);
				return index;
			default:
				return this.#insert(entry, index);
		}
	}

	/**
	 * Rearrangement: marks the first and last glyph of a range, and applies the entry's verb,
	 * which moves up to two glyphs from each end of the range to the other.
	 *
	 * @param entry - The entry.
	 * @param index - Buffer index of the current glyph.
	 */
	#rearrange(entry: Entry, index: number) {
		let { flags } = entry;
		if ((flags & FLAG.MARK_FIRST) !== 0) this.#first = index;
		if ((flags & FLAG.MARK_LAST) !== 0) this.#last = Math.min(index + 1, this.glyphs.length);
		let verb = VERBS[flags & FLAG.VERB] ?? 0;
		let start = this.#first;
		let end = this.#last;
		let left = Math.min(2, verb >> 4);
		let right = Math.min(2, verb & 0x0f);
		if (verb === 0 || start >= end || end - start < left + right) return;
		let glyphs = this.glyphs;
		let head = glyphs.slice(start, start + left);
		let tail = glyphs.slice(end - right, end);
		if (verb >> 4 === 3) head.reverse();
		if ((verb & 0x0f) === 3) tail.reverse();
		let middle = glyphs.slice(start + left, end - right);
		glyphs.splice(start, end - start, ...tail, ...middle, ...head);
	}

	/**
	 * Contextual substitution: replaces the marked glyph and the current glyph through the
	 * lookup tables the entry names, then marks the current glyph when the entry says so.
	 *
	 * @param entry - The entry.
	 * @param index - Buffer index of the current glyph.
	 */
	#contextual(entry: Entry, index: number) {
		let reader = this.#reader;
		let header = this.#subtable?.body ?? 0;
		let substitutions = header + reader.u32(header + 16);
		let markLookup = reader.u16(entry.offset + 4);
		let currentLookup = reader.u16(entry.offset + 6);
		if (markLookup !== 0xffff && this.#mark !== null) {
			this.#substitute(substitutions, markLookup, this.#mark);
		}
		if (currentLookup !== 0xffff) this.#substitute(substitutions, currentLookup, index);
		if ((entry.flags & FLAG.SET_MARK) !== 0) this.#mark = index;
	}

	/**
	 * Replaces one glyph through a contextual subtable's lookup table, when it covers the glyph.
	 *
	 * @param substitutions - Absolute offset of the substitution table's offset array.
	 * @param lookupIndex - Which lookup table.
	 * @param index - Buffer index of the glyph.
	 */
	#substitute(substitutions: number, lookupIndex: number, index: number) {
		let glyph = this.glyphs[index];
		if (glyph === undefined) return;
		let lookup = substitutions + this.#reader.u32(substitutions + lookupIndex * 4);
		let replacement = aatLookup(this.#reader, lookup, glyph.glyph, this.#numGlyphs);
		if (replacement !== null) glyph.glyph = replacement;
	}

	/**
	 * Ligature: remembers component glyphs, and on an action pops them, summing each one's
	 * component value into a ligature list index. The last popped glyph of each ligature
	 * becomes the ligature, holding every component's characters; the others are deleted.
	 *
	 * @param entry - The entry.
	 * @param index - Buffer index of the current glyph.
	 */
	#ligature(entry: Entry, index: number) {
		let { flags } = entry;
		let stack = this.#components;
		if ((flags & FLAG.SET_COMPONENT) !== 0 && stack.at(-1) !== index) {
			stack.push(index);
			if (stack.length > MAX_COMPONENTS) stack.shift();
		}
		if ((flags & FLAG.PERFORM_ACTION) === 0) return;
		let reader = this.#reader;
		let header = this.#subtable?.body ?? 0;
		let actions = header + reader.u32(header + 16);
		let components = header + reader.u32(header + 20);
		let ligatures = header + reader.u32(header + 24);
		let actionIndex = reader.u16(entry.offset + 4);
		let ligatureIndex = 0;
		let codePoints: number[] = [];
		let cluster = Infinity;
		let formed: number[] = [];
		let last = false;
		while (!last && stack.length > 0) {
			let position = stack.pop() ?? 0;
			let glyph = this.glyphs[position];
			if (glyph === undefined) break;
			let action = reader.u32(actions + actionIndex * 4);
			actionIndex++;
			last = (action & ACTION.LAST) !== 0;
			let offset = (action << 2) >> 2;
			ligatureIndex += reader.u16(components + (offset + glyph.glyph) * 2);
			codePoints.unshift(...glyph.codePoints);
			cluster = Math.min(cluster, glyph.cluster);
			if (last || (action & ACTION.STORE) !== 0) {
				glyph.glyph = reader.u16(ligatures + ligatureIndex * 2);
				glyph.codePoints = codePoints;
				glyph.cluster = cluster;
				glyph.isLigated = true;
				formed.push(position);
				ligatureIndex = 0;
				codePoints = [];
				cluster = Infinity;
			} else {
				glyph.codePoints = [];
				glyph.glyph = DELETED_GLYPH;
			}
		}
		stack.push(...formed);
	}

	/**
	 * Insertion: inserts glyphs from the insertion action list before or after the marked
	 * glyph and the current glyph, then marks the current glyph when the entry says so.
	 *
	 * @param entry - The entry.
	 * @param index - Buffer index of the current glyph.
	 * @returns Where the machine continues from: past the inserted glyphs, or at the first
	 *   one when the entry does not advance.
	 */
	#insert(entry: Entry, index: number): number {
		let { flags } = entry;
		let reader = this.#reader;
		let header = this.#subtable?.body ?? 0;
		let actions = header + reader.u32(header + 16);
		let current = index;
		let markedAction = reader.u16(entry.offset + 6);
		if (markedAction !== 0xffff && this.#mark !== null) {
			let count = flags & FLAG.MARKED_INSERT_COUNT;
			let before = (flags & FLAG.MARKED_INSERT_BEFORE) !== 0;
			let at = this.#mark + (before ? 0 : 1);
			let inserted = this.#insertGlyphs(at, actions + markedAction * 2, count, this.#mark);
			if (at <= current) current += inserted;
		}
		if ((flags & FLAG.SET_MARK) !== 0) this.#mark = current;
		let currentAction = reader.u16(entry.offset + 4);
		if (currentAction === 0xffff) return current;
		let count = (flags & FLAG.CURRENT_INSERT_COUNT) >> 5;
		let before = (flags & FLAG.CURRENT_INSERT_BEFORE) !== 0;
		let at = current + (before ? 0 : 1);
		let inserted = this.#insertGlyphs(at, actions + currentAction * 2, count, current);
		if ((flags & FLAG.DONT_ADVANCE) !== 0) return at;
		return current + inserted;
	}

	/**
	 * Inserts glyphs into the buffer, each in the cluster of the glyph it is inserted next to.
	 *
	 * @param at - Buffer index to insert at.
	 * @param from - Absolute offset of the first glyph id in the insertion action list.
	 * @param count - How many glyphs.
	 * @param anchor - Buffer index of the glyph whose cluster they join.
	 * @returns How many glyphs were inserted; none once the buffer reaches its size limit.
	 */
	#insertGlyphs(at: number, from: number, count: number, anchor: number): number {
		let neighbour = this.glyphs[anchor];
		if (neighbour === undefined || this.glyphs.length + count > this.#maxLength) return 0;
		let inserted: GlyphInfo[] = [];
		for (let item = 0; item < count; item++) {
			let glyph = this.#reader.u16(from + item * 2);
			inserted.push(new GlyphInfo(this.font, glyph, [], neighbour.cluster, neighbour.features));
		}
		this.glyphs.splice(at, 0, ...inserted);
		return count;
	}

	/**
	 * Noncontextual substitution: replaces every glyph the lookup table covers.
	 *
	 * @param lookup - Absolute offset of the lookup table.
	 */
	#noncontextual(lookup: number) {
		for (let glyph of this.glyphs) {
			if (glyph.glyph === DELETED_GLYPH) continue;
			let replacement = aatLookup(this.#reader, lookup, glyph.glyph, this.#numGlyphs);
			if (replacement !== null) glyph.glyph = replacement;
		}
	}
}
