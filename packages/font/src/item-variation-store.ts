/**
 * OpenType ItemVariationStore and DeltaSetIndexMap: the delta storage HVAR, MVAR, GDEF and
 * CFF2 share. `readItemVariationStore(reader, offset)` locates a store, `blendScalars` and
 * `itemDelta(store, outer, inner, coords)` evaluate it at normalized coordinates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Reader } from "./reader.js";

/** One ItemVariationData subtable: a block of delta rows over a list of regions. */
export interface ItemVariationData {
	/** Absolute offset of the first delta row. */
	rowsOffset: number;
	itemCount: number;
	/** How many leading columns of each row are wide (16-bit, or 32-bit with `longWords`). */
	wordCount: number;
	longWords: boolean;
	/** Region-list index of each column. */
	regionIndexes: number[];
	/** Bytes per delta row. */
	rowSize: number;
}

/** A located ItemVariationStore; regions are read from the bytes when a scalar is asked for. */
export interface ItemVariationStore {
	reader: Reader;
	/** Absolute offset of the first region record. */
	regionsOffset: number;
	/** Axes per region, the font's `fvar` axis count. */
	axisCount: number;
	regionCount: number;
	data: ItemVariationData[];
}

/** A DeltaSetIndexMap: which `(outer, inner)` delta set each glyph or item reads. */
export interface DeltaSetIndexMap {
	reader: Reader;
	/** Absolute offset of the first entry. */
	entriesOffset: number;
	mapCount: number;
	entrySize: number;
	innerBits: number;
}

/** An `(outer, inner)` address into an ItemVariationStore. */
export interface DeltaSetIndex {
	outer: number;
	inner: number;
}

/** ItemVariationData `wordDeltaCount` bit making wide columns 32-bit and narrow ones 16-bit. */
const LONG_WORDS = 0x8000;

/**
 * Locates the ItemVariationStore at `offset`. Region and row bounds are checked against the
 * file, so a truncated store yields fewer subtables and every later read stays in range.
 *
 * @param reader - The whole file.
 * @param offset - Absolute offset of the store.
 * @returns The store, or `null` when the format is unknown or the header is past the end.
 */
export function readItemVariationStore(reader: Reader, offset: number): ItemVariationStore | null {
	if (offset < 0 || offset + 8 > reader.length || reader.u16(offset) !== 1) return null;
	let regionList = offset + reader.u32(offset + 2);
	let axisCount = reader.u16(regionList);
	let regionCount = reader.u16(regionList + 2);
	let dataCount = reader.u16(offset + 6);
	let data: ItemVariationData[] = [];
	for (let index = 0; index < dataCount; index++) {
		let start = offset + reader.u32(offset + 8 + index * 4);
		let itemCount = reader.u16(start);
		let wordDeltaCount = reader.u16(start + 2);
		let regionIndexCount = reader.u16(start + 4);
		let longWords = (wordDeltaCount & LONG_WORDS) !== 0;
		let wordCount = Math.min(wordDeltaCount & ~LONG_WORDS, regionIndexCount);
		let regionIndexes: number[] = [];
		for (let column = 0; column < regionIndexCount; column++) {
			regionIndexes.push(reader.u16(start + 6 + column * 2));
		}
		let wide = longWords ? 4 : 2;
		let rowSize = wordCount * wide + (regionIndexCount - wordCount) * (wide / 2);
		data.push({
			rowsOffset: start + 6 + regionIndexCount * 2,
			itemCount,
			wordCount,
			longWords,
			regionIndexes,
			rowSize,
		});
	}
	return { reader, regionsOffset: regionList + 4, axisCount, regionCount, data };
}

/**
 * How much one axis of a region contributes at `coord`: `1` at the peak, falling linearly to
 * `0` at `start` and `end`. A peak of `0` and an inconsistent or zero-straddling range leave
 * the axis out of the product, answering `1`.
 *
 * @param start - Lower end of the region on this axis, normalized.
 * @param peak - Where the region applies fully.
 * @param end - Upper end of the region.
 * @param coord - The instance's normalized coordinate on this axis.
 */
export function axisScalar(start: number, peak: number, end: number, coord: number): number {
	if (peak === 0 || start > peak || peak > end) return 1;
	if (start < 0 && end > 0) return 1;
	if (coord < start || coord > end) return 0;
	if (coord === peak) return 1;
	if (coord < peak) return (coord - start) / (peak - start);
	return (end - coord) / (end - peak);
}

/**
 * The scalar of one region of the store at the given coordinates, the product of its
 * per-axis scalars; an index outside the region list answers `0`.
 *
 * @param store - The store.
 * @param region - Index in the region list.
 * @param coords - Normalized coordinates, one per `fvar` axis; missing axes read as `0`.
 */
export function regionScalar(
	store: ItemVariationStore,
	region: number,
	coords: readonly number[],
): number {
	if (region >= store.regionCount) return 0;
	let { reader, axisCount } = store;
	let record = store.regionsOffset + region * axisCount * 6;
	let scalar = 1;
	for (let axis = 0; axis < axisCount && scalar !== 0; axis++) {
		let at = record + axis * 6;
		scalar *= axisScalar(
			reader.f2dot14(at),
			reader.f2dot14(at + 2),
			reader.f2dot14(at + 4),
			coords[axis] ?? 0,
		);
	}
	return scalar;
}

/**
 * The scalar of every column of one ItemVariationData, in column order. CFF2 `blend`
 * multiplies its operand deltas by these, so they follow the subtable `vsindex` selects.
 *
 * @param store - The store.
 * @param outer - ItemVariationData index; an unknown one answers `[]`.
 * @param coords - Normalized coordinates.
 */
export function blendScalars(
	store: ItemVariationStore,
	outer: number,
	coords: readonly number[],
): number[] {
	let data = store.data[outer];
	if (data === undefined) return [];
	return data.regionIndexes.map((region) => regionScalar(store, region, coords));
}

/**
 * The raw deltas of one row, in column order; an unknown address answers `[]`.
 *
 * @param store - The store.
 * @param outer - ItemVariationData index.
 * @param inner - Row index inside it.
 */
export function rowDeltas(store: ItemVariationStore, outer: number, inner: number): number[] {
	let data = store.data[outer];
	if (data === undefined || inner < 0 || inner >= data.itemCount) return [];
	let { reader } = store;
	let at = data.rowsOffset + inner * data.rowSize;
	let deltas: number[] = [];
	for (let column = 0; column < data.regionIndexes.length; column++) {
		if (data.longWords) {
			if (column < data.wordCount) {
				deltas.push(reader.u32(at) | 0);
				at += 4;
			} else {
				deltas.push(reader.i16(at));
				at += 2;
			}
		} else if (column < data.wordCount) {
			deltas.push(reader.i16(at));
			at += 2;
		} else {
			deltas.push(reader.i8(at));
			at += 1;
		}
	}
	return deltas;
}

/**
 * The interpolated delta of one item at the given coordinates, unrounded; an address the
 * store does not hold answers `0`, as the format requires.
 *
 * @param store - The store.
 * @param outer - ItemVariationData index.
 * @param inner - Row index inside it.
 * @param coords - Normalized coordinates.
 * @example Math.round(itemDelta(hvar, 0, glyph, coords))
 */
export function itemDelta(
	store: ItemVariationStore,
	outer: number,
	inner: number,
	coords: readonly number[],
): number {
	let deltas = rowDeltas(store, outer, inner);
	if (deltas.length === 0) return 0;
	let regionIndexes = store.data[outer]?.regionIndexes ?? [];
	let total = 0;
	for (let column = 0; column < deltas.length; column++) {
		let delta = deltas[column] ?? 0;
		if (delta === 0) continue;
		total += delta * regionScalar(store, regionIndexes[column] ?? 0, coords);
	}
	return total;
}

/**
 * Locates a DeltaSetIndexMap (format 0 or 1).
 *
 * @param reader - The whole file.
 * @param offset - Absolute offset of the map.
 * @returns The map, or `null` when the format is unknown or the header is past the end.
 */
export function readDeltaSetIndexMap(reader: Reader, offset: number): DeltaSetIndexMap | null {
	if (offset < 0 || offset + 4 > reader.length) return null;
	let format = reader.u8(offset);
	if (format !== 0 && format !== 1) return null;
	let entryFormat = reader.u8(offset + 1);
	let mapCount = format === 0 ? reader.u16(offset + 2) : reader.u32(offset + 2);
	return {
		reader,
		entriesOffset: offset + (format === 0 ? 4 : 6),
		mapCount,
		entrySize: ((entryFormat & 0x30) >> 4) + 1,
		innerBits: (entryFormat & 0x0f) + 1,
	};
}

/**
 * The delta-set address of an item. An index past the map's end reads its last entry, so a
 * map may stop at the last glyph whose address differs from the one after it.
 *
 * @param map - The map.
 * @param index - Glyph or item index.
 */
export function mapDeltaSetIndex(map: DeltaSetIndexMap, index: number): DeltaSetIndex {
	if (map.mapCount === 0) return { outer: 0, inner: index };
	let at = map.entriesOffset + Math.min(index, map.mapCount - 1) * map.entrySize;
	let entry = 0;
	for (let byte = 0; byte < map.entrySize; byte++) entry = entry * 256 + map.reader.u8(at + byte);
	let divisor = 2 ** map.innerBits;
	return { outer: Math.floor(entry / divisor), inner: entry % divisor };
}
