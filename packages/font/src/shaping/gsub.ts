/**
 * Glyph substitution: applies GSUB lookup types 1 to 8 to the shaping buffer. Ligatures
 * record which component each skipped mark belongs to, so GPOS can later attach marks to
 * the right part of the ligature.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Lookup } from "./layout-table.js";

import { GlyphInfo } from "./glyph-info.js";
import { coverageIndex } from "./layout-table.js";
import { LayoutProcessor } from "./processor.js";

/** GSUB lookup types. */
const GSUB_TYPE = {
	SINGLE: 1,
	MULTIPLE: 2,
	ALTERNATE: 3,
	LIGATURE: 4,
	CONTEXT: 5,
	CHAINING: 6,
	REVERSE_CHAINING: 8,
};

/** Runs GSUB lookups over a buffer, changing glyphs and the buffer's length in place. */
export class GsubProcessor extends LayoutProcessor {
	/** The next ligature id to hand out; ids tie marks to the ligature they were skipped in. */
	#ligatureId = 1;

	/**
	 * Reverse chaining substitutions walk from the end, so a substitution is visible to the
	 * lookahead of the glyphs before it.
	 *
	 * @param planned - The lookup.
	 */
	override isReverseLookup(planned: Lookup): boolean {
		return planned.type === GSUB_TYPE.REVERSE_CHAINING;
	}

	/**
	 * Whether any lookup of a feature would change the given glyphs; shapers probe features
	 * this way (a consonant that takes a below-base form) on a throwaway copy of the glyphs.
	 *
	 * @param tag - A feature tag the selected language system enables.
	 * @param glyphs - Glyphs carrying the feature; they are changed in place.
	 */
	wouldSubstitute(tag: string, glyphs: GlyphInfo[]): boolean {
		for (let glyph of glyphs) glyph.substituted = false;
		this.applyFeatures([tag], glyphs);
		return glyphs.some((glyph) => glyph.substituted);
	}

	/**
	 * Applies one GSUB subtable at the cursor.
	 *
	 * @param type - The lookup type.
	 * @param offset - Absolute offset of the subtable.
	 */
	applySubtable(type: number, offset: number): boolean {
		let { reader } = this.font;
		let glyph = this.iterator.current;
		if (glyph === null) return false;
		if (type === GSUB_TYPE.CONTEXT) return this.applyContext(offset);
		if (type === GSUB_TYPE.CHAINING) return this.applyChainingContext(offset);
		let index = coverageIndex(reader, offset + reader.u16(offset + 2), glyph.glyph);
		if (index === -1) return false;
		switch (type) {
			case GSUB_TYPE.SINGLE: {
				let format = reader.u16(offset);
				if (format === 1) glyph.glyph = (glyph.glyph + reader.i16(offset + 4)) & 0xffff;
				else if (format === 2 && index < reader.u16(offset + 4)) {
					glyph.glyph = reader.u16(offset + 6 + index * 2);
				} else return false;
				return true;
			}
			case GSUB_TYPE.MULTIPLE:
				return this.#multiple(offset, index);
			case GSUB_TYPE.ALTERNATE: {
				if (index >= reader.u16(offset + 4)) return false;
				let set = offset + reader.u16(offset + 6 + index * 2);
				let count = reader.u16(set);
				if (count === 0) return false;
				let choice = this.featureValue() - 1;
				if (!Number.isInteger(choice) || choice < 0 || choice >= count) choice = 0;
				glyph.glyph = reader.u16(set + 2 + choice * 2);
				return true;
			}
			case GSUB_TYPE.LIGATURE:
				return this.#ligature(offset, index);
			case GSUB_TYPE.REVERSE_CHAINING:
				return this.#reverseChaining(offset, index);
			default:
				return false;
		}
	}

	/**
	 * Replaces the glyph with a sequence; an empty sequence deletes it. The cursor ends on the
	 * last inserted glyph, so the lookup never applies to its own output.
	 *
	 * @param offset - Absolute offset of the subtable.
	 * @param index - The glyph's coverage index.
	 */
	#multiple(offset: number, index: number): boolean {
		let { reader } = this.font;
		let iterator = this.iterator;
		let glyph = iterator.current;
		if (glyph === null || index >= reader.u16(offset + 4)) return false;
		let sequence = offset + reader.u16(offset + 6 + index * 2);
		let count = reader.u16(sequence);
		if (count === 0) {
			this.glyphs.splice(iterator.index, 1);
			iterator.index--;
			return true;
		}
		if (this.glyphs.length + count - 1 > this.maxLength) return false;
		glyph.glyph = reader.u16(sequence + 2);
		glyph.ligatureComponent = 0;
		let inserted: GlyphInfo[] = [];
		for (let item = 1; item < count; item++) {
			let copy = new GlyphInfo(
				this.font,
				reader.u16(sequence + 2 + item * 2),
				[],
				glyph.cluster,
				glyph.features,
			);
			copy.shaperInfo = glyph.shaperInfo;
			copy.isLigated = glyph.isLigated;
			copy.ligatureComponent = item;
			copy.substituted = true;
			copy.isMultiplied = true;
			inserted.push(copy);
		}
		this.glyphs.splice(iterator.index + 1, 0, ...inserted);
		iterator.index += inserted.length;
		return true;
	}

	/**
	 * Forms the first ligature of the set whose components follow the cursor. Marks skipped
	 * between components join the ligature's id, numbered by the component they follow.
	 *
	 * @param offset - Absolute offset of the subtable.
	 * @param index - The first component's coverage index.
	 */
	#ligature(offset: number, index: number): boolean {
		let { reader } = this.font;
		let iterator = this.iterator;
		let current = iterator.current;
		if (current === null || index >= reader.u16(offset + 4)) return false;
		let set = offset + reader.u16(offset + 6 + index * 2);
		let count = reader.u16(set);
		for (let item = 0; item < count; item++) {
			let ligature = set + reader.u16(set + 2 + item * 2);
			let components = reader.u16(ligature + 2);
			if (components === 0) continue;
			let matched: number[] = [];
			let matches = this.match(
				1,
				components - 1,
				(component, glyph) =>
					this.currentFeatures.some((tag) => glyph.features.has(tag)) &&
					glyph.glyph === reader.u16(ligature + 4 + component * 2),
				matched,
			);
			if (!matches) continue;
			this.#formLigature(reader.u16(ligature), matched);
			return true;
		}
		return false;
	}

	/**
	 * Replaces the glyph at the cursor and the matched components with one ligature glyph.
	 *
	 * @param ligatureGlyph - The ligature's glyph index.
	 * @param matched - Buffer indices of the components after the first.
	 */
	#formLigature(ligatureGlyph: number, matched: number[]) {
		let glyphs = this.glyphs;
		let start = this.iterator.index;
		let current = glyphs[start];
		if (current === undefined) return;
		let characters = [...current.codePoints];
		for (let at of matched) characters.push(...(glyphs[at]?.codePoints ?? []));
		let last = matched.at(-1) ?? start;
		let cluster = current.cluster;
		for (let at = start; at <= last; at++)
			cluster = Math.min(cluster, glyphs[at]?.cluster ?? cluster);
		let ligature = new GlyphInfo(this.font, ligatureGlyph, characters, cluster, current.features);
		ligature.shaperInfo = current.shaperInfo;
		ligature.isLigated = true;
		ligature.substituted = true;
		let isMarkLigature = current.isMark && matched.every((at) => glyphs[at]?.isMark === true);
		ligature.ligatureId = isMarkLigature ? 0 : this.#ligatureId++;
		if (!isMarkLigature) this.#renumberComponents(ligature, current, matched);
		for (let at = start + 1; at <= last; at++) {
			let skipped = glyphs[at];
			if (skipped !== undefined && !matched.includes(at)) skipped.cluster = cluster;
		}
		for (let item = matched.length - 1; item >= 0; item--) glyphs.splice(matched[item] ?? 0, 1);
		glyphs[start] = ligature;
	}

	/**
	 * Gives the marks skipped inside a new ligature, and the marks that followed a component
	 * that was itself a ligature, the new ligature's id and the component they now follow.
	 *
	 * @param ligature - The new ligature glyph.
	 * @param first - The first component.
	 * @param matched - Buffer indices of the other components.
	 */
	#renumberComponents(ligature: GlyphInfo, first: GlyphInfo, matched: number[]) {
		let glyphs = this.glyphs;
		let lastId = first.ligatureId;
		let lastComponents = first.codePoints.length;
		let components = lastComponents;
		let at = this.iterator.index + 1;
		for (let next of matched) {
			for (; at < next; at++) {
				let skipped = glyphs[at];
				if (skipped === undefined) continue;
				skipped.ligatureId = ligature.ligatureId;
				skipped.ligatureComponent =
					components - lastComponents + Math.min(skipped.ligatureComponent || 1, lastComponents);
			}
			let component = glyphs[at];
			lastId = component?.ligatureId ?? 0;
			lastComponents = component?.codePoints.length ?? 0;
			components += lastComponents;
			at++;
		}
		if (lastId === 0) return;
		for (; at < glyphs.length; at++) {
			let mark = glyphs[at];
			if (mark === undefined || mark.ligatureId !== lastId) break;
			mark.ligatureComponent =
				components - lastComponents + Math.min(mark.ligatureComponent || 1, lastComponents);
		}
	}

	/**
	 * Reverse chaining single substitution: replaces the glyph when its backtrack and
	 * lookahead coverages match.
	 *
	 * @param offset - Absolute offset of the subtable.
	 * @param index - The glyph's coverage index.
	 */
	#reverseChaining(offset: number, index: number): boolean {
		let { reader } = this.font;
		let glyph = this.iterator.current;
		if (glyph === null) return false;
		let backtrack = reader.u16(offset + 4);
		let lookaheadAt = offset + 6 + backtrack * 2;
		let lookahead = reader.u16(lookaheadAt);
		let substitutesAt = lookaheadAt + 2 + lookahead * 2;
		let covered = (base: number) => (item: number, candidate: GlyphInfo) =>
			coverageIndex(reader, offset + reader.u16(base + item * 2), candidate.glyph) >= 0;
		if (!this.matchBacktrack(backtrack, covered(offset + 6))) return false;
		if (!this.match(1, lookahead, covered(lookaheadAt + 2))) return false;
		if (index >= reader.u16(substitutesAt)) return false;
		glyph.glyph = reader.u16(substitutesAt + 2 + index * 2);
		return true;
	}
}
