/**
 * The variation hooks of an instanced font: `instance()` attaches a `FontVariation` to a copy
 * of the font's data, and `Font` asks it for varied contours and advances. Everything is read
 * on demand and cached per glyph, so instancing a large font costs nothing up front.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FontData } from "../font.js";
import type { Point } from "../glyf.js";
import type { DeltaSetIndexMap, ItemVariationStore } from "../item-variation-store.js";

import {
	itemDelta,
	mapDeltaSetIndex,
	readDeltaSetIndexMap,
	readItemVariationStore,
} from "../item-variation-store.js";

import type { VariedGlyph } from "./glyph.js";
import type { GvarTable } from "./gvar.js";

import { defaultAdvance, variedGlyph } from "./glyph.js";
import { readGvar } from "./gvar.js";

/** A font's data with the instance it was varied to. */
export interface VariedFontData extends FontData {
	variation: FontVariation;
}

/** The `HVAR` advance deltas of a font. */
interface AdvanceVariations {
	store: ItemVariationStore;
	map: DeltaSetIndexMap | null;
}

/**
 * One instance of a variable font. `coords` (normalized, `fvar` axis order) is what CFF2
 * `blend`, GDEF/GPOS device deltas and feature variations read; `contours` and `advance`
 * answer each glyph at the instance, rounded to font units.
 */
export class FontVariation {
	/** Normalized coordinates after `avar`, one per `fvar` axis. */
	readonly coords: readonly number[];
	/** The user-space value of every axis, by tag. */
	readonly settings: Readonly<Record<string, number>>;
	/** The font at its default location, which the instance is computed from. */
	readonly base: FontData;

	#gvar: GvarTable | null;
	#advances: AdvanceVariations | null;
	#glyphs = new Map<number, VariedGlyph>();
	#widths = new Map<number, number>();

	/**
	 * @param base - The font at its default location.
	 * @param settings - The user-space value of every axis.
	 * @param coords - The same values normalized.
	 */
	constructor(base: FontData, settings: Readonly<Record<string, number>>, coords: number[]) {
		this.base = base;
		this.settings = settings;
		this.coords = coords;
		this.#gvar = base.cff === null ? readGvar(base.reader, base.tables) : null;
		this.#advances = readAdvanceVariations(base);
	}

	/**
	 * A TrueType glyph's contours at the instance, composites resolved, in font units, y up.
	 * A CFF2 font draws through its `CffOutlines` with `coords` instead.
	 *
	 * @param glyph - Glyph index.
	 */
	contours(glyph: number): Point[][] {
		return this.#glyph(glyph).contours;
	}

	/**
	 * A glyph's advance at the instance: the default plus the rounded `HVAR` delta when the
	 * font has `HVAR`, the distance between the varied phantom points otherwise.
	 *
	 * @param glyph - Glyph index; an index the font lacks answers `0`.
	 */
	advance(glyph: number): number {
		if (!Number.isInteger(glyph) || glyph < 0 || glyph >= this.base.numGlyphs) return 0;
		let cached = this.#widths.get(glyph);
		if (cached !== undefined) return cached;
		let width = defaultAdvance(this.base, glyph);
		if (this.#advances !== null) {
			let { store, map } = this.#advances;
			let address = map === null ? { outer: 0, inner: glyph } : mapDeltaSetIndex(map, glyph);
			width += Math.round(itemDelta(store, address.outer, address.inner, this.coords));
		} else if (this.#gvar !== null) {
			let varied = this.#glyph(glyph);
			width = varied.advanceX - varied.originX;
		}
		width = Math.max(width, 0);
		this.#widths.set(glyph, width);
		return width;
	}

	/**
	 * A glyph's left side bearing at the instance, the distance from the varied origin to the
	 * leftmost point of its varied contours; what a subsetter writes to `hmtx` beside `advance`.
	 *
	 * @param glyph - Glyph index; an empty glyph answers `0`.
	 */
	leftSideBearing(glyph: number): number {
		let varied = this.#glyph(glyph);
		let xMin = Infinity;
		for (let contour of varied.contours) for (let point of contour) xMin = Math.min(xMin, point.x);
		return xMin === Infinity ? 0 : xMin - varied.originX;
	}

	/**
	 * A glyph decoded at the instance, cached.
	 *
	 * @param glyph - Glyph index.
	 */
	#glyph(glyph: number): VariedGlyph {
		let cached = this.#glyphs.get(glyph);
		if (cached !== undefined) return cached;
		let varied = variedGlyph({ data: this.base, gvar: this.#gvar, coords: this.coords }, glyph);
		this.#glyphs.set(glyph, varied);
		return varied;
	}
}

/**
 * The instance a font's data was varied to, `null` for a font at its default location.
 *
 * @param data - A font's data.
 */
export function variationOf(data: FontData): FontVariation | null {
	if ("variation" in data && data.variation instanceof FontVariation) return data.variation;
	return null;
}

/**
 * Locates `HVAR`'s ItemVariationStore and advance mapping.
 *
 * @param data - The font at its default location.
 * @returns The advance variations, or `null` when the font has no usable `HVAR`.
 */
function readAdvanceVariations(data: FontData): AdvanceVariations | null {
	let hvar = data.tables.get("HVAR");
	if (hvar === undefined || hvar.length < 20) return null;
	let { reader } = data;
	let storeOffset = reader.u32(hvar.offset + 4);
	if (storeOffset === 0) return null;
	let store = readItemVariationStore(reader, hvar.offset + storeOffset);
	if (store === null) return null;
	let mapOffset = reader.u32(hvar.offset + 8);
	let map = mapOffset === 0 ? null : readDeltaSetIndexMap(reader, hvar.offset + mapOffset);
	return { store, map };
}

/**
 * The `MVAR` delta of every font-wide metric it varies, unrounded, by value tag (`hasc`,
 * `hdsc`, `hlgn`, `cpht`, `xhgt`, `undo`, `unds`…); empty without `MVAR`.
 *
 * @param data - The font at its default location.
 * @param coords - Normalized coordinates.
 */
export function metricDeltas(data: FontData, coords: readonly number[]): Map<string, number> {
	let deltas = new Map<string, number>();
	let mvar = data.tables.get("MVAR");
	if (mvar === undefined || mvar.length < 12) return deltas;
	let { reader } = data;
	let recordSize = reader.u16(mvar.offset + 6);
	let count = reader.u16(mvar.offset + 8);
	let storeOffset = reader.u16(mvar.offset + 10);
	if (recordSize < 8 || storeOffset === 0) return deltas;
	let store = readItemVariationStore(reader, mvar.offset + storeOffset);
	if (store === null) return deltas;
	for (let index = 0; index < count; index++) {
		let record = mvar.offset + 12 + index * recordSize;
		if (record + 8 > mvar.offset + mvar.length) break;
		let outer = reader.u16(record + 4);
		let inner = reader.u16(record + 6);
		deltas.set(reader.tag(record), itemDelta(store, outer, inner, coords));
	}
	return deltas;
}
