/**
 * Glyph positioning: applies GPOS lookup types 1 to 9 to the positions parallel to the
 * shaping buffer. Attachments are recorded as buffer indices and resolved into offsets once
 * every advance is final, so zeroing mark advances afterwards never shifts an attached mark.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GlyphInfo } from "./glyph-info.js";
import type { GlyphPosition } from "./processor.js";

import { coverageIndex, glyphClass, LOOKUP_FLAG } from "./layout-table.js";
import { LayoutProcessor } from "./processor.js";

/** GPOS lookup types. */
const GPOS_TYPE = {
	SINGLE: 1,
	PAIR: 2,
	CURSIVE: 3,
	MARK_TO_BASE: 4,
	MARK_TO_LIGATURE: 5,
	MARK_TO_MARK: 6,
	CONTEXT: 7,
	CHAINING: 8,
};

/** A point in font units. */
interface Anchor {
	x: number;
	y: number;
}

/**
 * How many bytes a value record of a `ValueFormat` occupies: two per set bit.
 *
 * @param format - The `ValueFormat` bits.
 */
function valueSize(format: number): number {
	let size = 0;
	for (let bit = format & 0xff; bit !== 0; bit >>= 1) size += (bit & 1) * 2;
	return size;
}

/** Runs GPOS lookups over a buffer's positions. */
export class GposProcessor extends LayoutProcessor {
	/**
	 * Applies one GPOS subtable at the cursor.
	 *
	 * @param type - The lookup type.
	 * @param offset - Absolute offset of the subtable.
	 */
	applySubtable(type: number, offset: number): boolean {
		let { reader } = this.font;
		let glyph = this.iterator.current;
		if (glyph === null) return false;
		switch (type) {
			case GPOS_TYPE.SINGLE: {
				let index = coverageIndex(reader, offset + reader.u16(offset + 2), glyph.glyph);
				if (index === -1) return false;
				let format = reader.u16(offset + 4);
				if (reader.u16(offset) === 1) this.#applyValue(this.iterator.index, offset + 6, format);
				else if (index < reader.u16(offset + 6)) {
					this.#applyValue(this.iterator.index, offset + 8 + index * valueSize(format), format);
				} else return false;
				return true;
			}
			case GPOS_TYPE.PAIR:
				return this.#pair(offset, glyph);
			case GPOS_TYPE.CURSIVE:
				return this.#cursive(offset, glyph);
			case GPOS_TYPE.MARK_TO_BASE:
			case GPOS_TYPE.MARK_TO_LIGATURE:
				return this.#markToBase(type, offset, glyph);
			case GPOS_TYPE.MARK_TO_MARK:
				return this.#markToMark(offset, glyph);
			case GPOS_TYPE.CONTEXT:
				return this.applyContext(offset);
			case GPOS_TYPE.CHAINING:
				return this.applyChainingContext(offset);
			default:
				return false;
		}
	}

	/**
	 * Adds a value record to a glyph's position. Device and variation adjustments are left
	 * out: positions are those of the default instance at the font's design resolution.
	 *
	 * @param index - Buffer index of the glyph.
	 * @param offset - Absolute offset of the value record.
	 * @param format - Its `ValueFormat`.
	 */
	#applyValue(index: number, offset: number, format: number) {
		let position = this.positions[index];
		if (position === undefined) return;
		let { reader } = this.font;
		let at = offset;
		if ((format & 0x0001) !== 0) {
			position.xOffset += reader.i16(at);
			at += 2;
		}
		if ((format & 0x0002) !== 0) {
			position.yOffset += reader.i16(at);
			at += 2;
		}
		if ((format & 0x0004) !== 0) {
			position.xAdvance += reader.i16(at);
			at += 2;
		}
		if ((format & 0x0008) !== 0) position.yAdvance += reader.i16(at);
	}

	/**
	 * Pair adjustment by glyph pair (format 1) or class pair (format 2). When the pair moves
	 * the second glyph too, the walk resumes after it, so it is not adjusted again as a first.
	 *
	 * @param offset - Absolute offset of the subtable.
	 * @param first - The glyph at the cursor.
	 */
	#pair(offset: number, first: GlyphInfo): boolean {
		let { reader } = this.font;
		let iterator = this.iterator;
		let secondIndex = iterator.peekIndex(1);
		let second = this.glyphs[secondIndex];
		if (second === undefined) return false;
		let index = coverageIndex(reader, offset + reader.u16(offset + 2), first.glyph);
		if (index === -1) return false;
		let format1 = reader.u16(offset + 4);
		let format2 = reader.u16(offset + 6);
		let size1 = valueSize(format1);
		let record = 0;
		if (reader.u16(offset) === 1) {
			if (index >= reader.u16(offset + 8)) return false;
			let set = offset + reader.u16(offset + 10 + index * 2);
			let stride = 2 + size1 + valueSize(format2);
			let low = 0;
			let high = reader.u16(set) - 1;
			while (low <= high && record === 0) {
				let middle = (low + high) >> 1;
				let entry = set + 2 + middle * stride;
				let glyph = reader.u16(entry);
				if (glyph === second.glyph) record = entry + 2;
				else if (glyph < second.glyph) low = middle + 1;
				else high = middle - 1;
			}
			if (record === 0) return false;
		} else if (reader.u16(offset) === 2) {
			let class1 = glyphClass(reader, offset + reader.u16(offset + 8), first.glyph);
			let class2 = glyphClass(reader, offset + reader.u16(offset + 10), second.glyph);
			let class1Count = reader.u16(offset + 12);
			let class2Count = reader.u16(offset + 14);
			if (class1 >= class1Count || class2 >= class2Count) return false;
			let stride = size1 + valueSize(format2);
			record = offset + 16 + (class1 * class2Count + class2) * stride;
		} else return false;
		this.#applyValue(iterator.index, record, format1);
		this.#applyValue(secondIndex, record + size1, format2);
		if (format2 !== 0) iterator.index = secondIndex;
		return true;
	}

	/**
	 * An anchor's coordinates; formats 2 and 3 add a contour point and device tables, which
	 * apply only to hinted or variable rendering, so their design coordinates are used.
	 *
	 * @param offset - Absolute offset of the anchor table.
	 */
	#anchor(offset: number): Anchor {
		let { reader } = this.font;
		return { x: reader.i16(offset + 2), y: reader.i16(offset + 4) };
	}

	/**
	 * Cursive attachment: joins the cursor glyph's exit anchor to the next glyph's entry
	 * anchor, moving advances along the run's direction and recording the vertical link.
	 *
	 * @param offset - Absolute offset of the subtable.
	 * @param glyph - The glyph at the cursor.
	 */
	#cursive(offset: number, glyph: GlyphInfo): boolean {
		let { reader } = this.font;
		let iterator = this.iterator;
		let nextIndex = iterator.peekIndex(1);
		let next = this.glyphs[nextIndex];
		if (next === undefined) return false;
		let coverage = offset + reader.u16(offset + 2);
		let count = reader.u16(offset + 4);
		let currentIndex = coverageIndex(reader, coverage, glyph.glyph);
		let followingIndex = coverageIndex(reader, coverage, next.glyph);
		if (currentIndex === -1 || followingIndex === -1) return false;
		if (currentIndex >= count || followingIndex >= count) return false;
		let exitOffset = reader.u16(offset + 6 + currentIndex * 4 + 2);
		let entryOffset = reader.u16(offset + 6 + followingIndex * 4);
		if (exitOffset === 0 || entryOffset === 0) return false;
		let exit = this.#anchor(offset + exitOffset);
		let entry = this.#anchor(offset + entryOffset);
		let current = this.positions[iterator.index];
		let following = this.positions[nextIndex];
		if (current === undefined || following === undefined) return false;
		if (this.direction === "ltr") {
			current.xAdvance = exit.x + current.xOffset;
			let delta = entry.x + following.xOffset;
			following.xAdvance -= delta;
			following.xOffset -= delta;
		} else {
			let delta = exit.x + current.xOffset;
			current.xAdvance -= delta;
			current.xOffset -= delta;
			following.xAdvance = entry.x + following.xOffset;
		}
		if ((iterator.flags & LOOKUP_FLAG.RIGHT_TO_LEFT) !== 0) {
			glyph.cursiveAttachment = nextIndex;
			current.yOffset = entry.y - exit.y;
		} else {
			next.cursiveAttachment = iterator.index;
			current.yOffset = exit.y - entry.y;
		}
		return true;
	}

	/**
	 * Mark-to-base and mark-to-ligature attachment: finds the base the mark follows and
	 * aligns the mark's anchor with the base's anchor for its class (for a ligature, the
	 * anchor of the component the mark belongs to).
	 *
	 * @param type - `4` or `5`.
	 * @param offset - Absolute offset of the subtable.
	 * @param mark - The mark at the cursor.
	 */
	#markToBase(type: number, offset: number, mark: GlyphInfo): boolean {
		let { reader } = this.font;
		let markIndex = coverageIndex(reader, offset + reader.u16(offset + 2), mark.glyph);
		if (markIndex === -1) return false;
		let baseIndex = this.iterator.index - 1;
		while (baseIndex >= 0) {
			let candidate = this.glyphs[baseIndex];
			let skip =
				candidate !== undefined &&
				(candidate.isMark || (type === 4 && candidate.ligatureComponent > 0));
			if (!skip) break;
			baseIndex--;
		}
		let base = this.glyphs[baseIndex];
		if (base === undefined) return false;
		let coverage = coverageIndex(reader, offset + reader.u16(offset + 4), base.glyph);
		if (coverage === -1) return false;
		let classCount = reader.u16(offset + 6);
		let markArray = offset + reader.u16(offset + 8);
		let baseArray = offset + reader.u16(offset + 10);
		if (coverage >= reader.u16(baseArray)) return false;
		let anchorTable = baseArray;
		let row = baseArray + 2 + coverage * classCount * 2;
		if (type === GPOS_TYPE.MARK_TO_LIGATURE) {
			let attach = baseArray + reader.u16(baseArray + 2 + coverage * 2);
			let components = reader.u16(attach);
			if (components === 0) return false;
			let component = components - 1;
			if (
				base.ligatureId !== 0 &&
				base.ligatureId === mark.ligatureId &&
				mark.ligatureComponent > 0
			) {
				component = Math.min(mark.ligatureComponent, components) - 1;
			}
			anchorTable = attach;
			row = attach + 2 + component * classCount * 2;
		}
		return this.#attach(markArray, markIndex, classCount, anchorTable, row, baseIndex);
	}

	/**
	 * Mark-to-mark attachment onto the previous considered mark, when both marks belong to
	 * the same base or ligature component, or one of them is itself a mark ligature.
	 *
	 * @param offset - Absolute offset of the subtable.
	 * @param mark - The mark at the cursor.
	 */
	#markToMark(offset: number, mark: GlyphInfo): boolean {
		let { reader } = this.font;
		let markIndex = coverageIndex(reader, offset + reader.u16(offset + 2), mark.glyph);
		if (markIndex === -1) return false;
		let previousIndex = this.iterator.peekIndex(-1);
		let previous = this.glyphs[previousIndex];
		if (previous === undefined || !previous.isMark) return false;
		let good = false;
		if (mark.ligatureId === previous.ligatureId) {
			good = mark.ligatureId === 0 || mark.ligatureComponent === previous.ligatureComponent;
		} else {
			good =
				(mark.ligatureId !== 0 && mark.ligatureComponent === 0) ||
				(previous.ligatureId !== 0 && previous.ligatureComponent === 0);
		}
		if (!good) return false;
		let coverage = coverageIndex(reader, offset + reader.u16(offset + 4), previous.glyph);
		if (coverage === -1) return false;
		let classCount = reader.u16(offset + 6);
		let markArray = offset + reader.u16(offset + 8);
		let mark2Array = offset + reader.u16(offset + 10);
		if (coverage >= reader.u16(mark2Array)) return false;
		let row = mark2Array + 2 + coverage * classCount * 2;
		return this.#attach(markArray, markIndex, classCount, mark2Array, row, previousIndex);
	}

	/**
	 * Offsets the mark at the cursor so its anchor meets the target's anchor for its class;
	 * a missing anchor on either side leaves the mark where it is.
	 *
	 * @param markArray - Absolute offset of the mark array.
	 * @param markIndex - The mark's coverage index.
	 * @param classCount - How many mark classes the subtable has.
	 * @param anchorTable - Absolute offset the target's anchor offsets are relative to.
	 * @param row - Absolute offset of the target's anchor offsets, one per class.
	 * @param targetIndex - Buffer index of the base, ligature or mark attached to.
	 */
	#attach(
		markArray: number,
		markIndex: number,
		classCount: number,
		anchorTable: number,
		row: number,
		targetIndex: number,
	): boolean {
		let { reader } = this.font;
		if (markIndex >= reader.u16(markArray)) return false;
		let record = markArray + 2 + markIndex * 4;
		let markClass = reader.u16(record);
		let markAnchor = reader.u16(record + 2);
		if (markClass >= classCount) return false;
		let targetAnchor = reader.u16(row + markClass * 2);
		if (markAnchor === 0 || targetAnchor === 0) return true;
		let target = this.#anchor(anchorTable + targetAnchor);
		let own = this.#anchor(markArray + markAnchor);
		let position = this.positions[this.iterator.index];
		let glyph = this.iterator.current;
		if (position === undefined || glyph === null) return false;
		position.xOffset = target.x - own.x;
		position.yOffset = target.y - own.y;
		glyph.markAttachment = targetIndex;
		return true;
	}

	/**
	 * Turns recorded attachments into offsets once advances are final: cursive chains
	 * accumulate their vertical offsets, and marks add their target's offset less the
	 * advances between them.
	 *
	 * @param glyphs - The buffer GPOS ran over.
	 * @param positions - Its positions.
	 */
	fixAttachments(glyphs: GlyphInfo[], positions: GlyphPosition[]) {
		let resolved = new Set<number>();
		let resolve = (index: number) => {
			let glyph = glyphs[index];
			let position = positions[index];
			if (glyph?.cursiveAttachment == null || position === undefined || resolved.has(index)) return;
			resolved.add(index);
			let target = glyph.cursiveAttachment;
			resolve(target);
			position.yOffset += positions[target]?.yOffset ?? 0;
		};
		for (let index = 0; index < glyphs.length; index++) resolve(index);
		for (let index = 0; index < glyphs.length; index++) {
			let target = glyphs[index]?.markAttachment;
			let position = positions[index];
			if (target == null || position === undefined) continue;
			position.xOffset += positions[target]?.xOffset ?? 0;
			position.yOffset += positions[target]?.yOffset ?? 0;
			if (this.direction === "ltr") {
				for (let between = target; between < index; between++) {
					position.xOffset -= positions[between]?.xAdvance ?? 0;
					position.yOffset -= positions[between]?.yAdvance ?? 0;
				}
			} else {
				for (let between = target + 1; between <= index; between++) {
					position.xOffset += positions[between]?.xAdvance ?? 0;
					position.yOffset += positions[between]?.yAdvance ?? 0;
				}
			}
		}
	}
}
