/**
 * Reads a variable font's `fvar` axes and named instances, `avar` segment maps, and turns
 * user-space axis values (`wght: 700`) into the normalized coordinates every variation table
 * is keyed by. Axis and instance names come from the `name` table, in English.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRecord } from "../font.js";
import type { Reader } from "../reader.js";

import { pickName, readNames } from "../names.js";

/** One design axis of a variable font, in user-space units. */
export interface Axis {
	/** Four-character axis tag: `wght`, `wdth`, `opsz`, `ital`, `slnt` or a custom one. */
	tag: string;
	/** The axis name from the `name` table, the tag when the font records none. */
	name: string;
	min: number;
	default: number;
	max: number;
	/** Set when the font asks user interfaces to leave the axis out of their controls. */
	hidden: boolean;
}

/** A named point in the design space, such as "Bold" or "Condensed Light". */
export interface NamedInstance {
	/** The subfamily name from the `name` table. */
	name: string;
	/** The instance's PostScript name, `null` when the font records none. */
	postscriptName: string | null;
	/** User-space value of every axis, by tag. */
	coordinates: Record<string, number>;
}

/** `fvar` axis flag asking user interfaces to hide the axis. */
const HIDDEN_AXIS = 0x0001;

/** `fvar` name ID meaning "no PostScript name for this instance". */
const NO_NAME = 0xffff;

/**
 * The `fvar` axes, in table order; a font without `fvar` has none. Axis order is the order
 * of every normalized coordinate list in this package.
 *
 * @param reader - The whole file.
 * @param tables - The table directory.
 */
export function readAxes(reader: Reader, tables: Map<string, TableRecord>): Axis[] {
	let fvar = tables.get("fvar");
	if (fvar === undefined || fvar.length < 16) return [];
	let start = fvar.offset + reader.u16(fvar.offset + 4);
	let axisCount = reader.u16(fvar.offset + 8);
	let axisSize = reader.u16(fvar.offset + 10);
	let names = readNames(reader, tables.get("name"));
	let axes: Axis[] = [];
	if (axisSize < 20) return axes;
	for (let index = 0; index < axisCount; index++) {
		let record = start + index * axisSize;
		if (record + 20 > fvar.offset + fvar.length) break;
		let tag = reader.tag(record);
		let min = fixed(reader, record + 4);
		let value = fixed(reader, record + 8);
		let max = fixed(reader, record + 12);
		let flags = reader.u16(record + 16);
		let nameId = reader.u16(record + 18);
		axes.push({
			tag,
			name: pickName(names, nameId) ?? tag,
			min: Math.min(min, value),
			default: value,
			max: Math.max(max, value),
			hidden: (flags & HIDDEN_AXIS) !== 0,
		});
	}
	return axes;
}

/**
 * The `fvar` named instances, in table order, each with every axis's user-space value.
 *
 * @param reader - The whole file.
 * @param tables - The table directory.
 * @param axes - The axes `readAxes` answered for the same font.
 */
export function readNamedInstances(
	reader: Reader,
	tables: Map<string, TableRecord>,
	axes: readonly Axis[],
): NamedInstance[] {
	let fvar = tables.get("fvar");
	if (fvar === undefined || fvar.length < 16) return [];
	let axisCount = reader.u16(fvar.offset + 8);
	let axisSize = reader.u16(fvar.offset + 10);
	let instanceCount = reader.u16(fvar.offset + 12);
	let instanceSize = reader.u16(fvar.offset + 14);
	if (axisCount !== axes.length || instanceSize < 4 + axisCount * 4) return [];
	let start = fvar.offset + reader.u16(fvar.offset + 4) + axisCount * axisSize;
	let hasPostscriptName = instanceSize >= 6 + axisCount * 4;
	let names = readNames(reader, tables.get("name"));
	let instances: NamedInstance[] = [];
	for (let index = 0; index < instanceCount; index++) {
		let record = start + index * instanceSize;
		if (record + instanceSize > fvar.offset + fvar.length) break;
		let coordinates: Record<string, number> = {};
		for (let [axis, { tag }] of axes.entries()) {
			coordinates[tag] = fixed(reader, record + 4 + axis * 4);
		}
		let postscriptId = hasPostscriptName ? reader.u16(record + 4 + axisCount * 4) : NO_NAME;
		let postscriptName = postscriptId === NO_NAME ? null : pickName(names, postscriptId);
		instances.push({
			name: pickName(names, reader.u16(record)) ?? "",
			postscriptName,
			coordinates,
		});
	}
	return instances;
}

/**
 * User-space axis values to normalized coordinates: each value is clamped to its axis,
 * mapped to -1…0…1 around the default, snapped to 2.14 precision and passed through `avar`.
 * Axes `settings` leaves out sit at their default, which normalizes to `0`.
 *
 * @param reader - The whole file.
 * @param tables - The table directory, for `avar`.
 * @param axes - The font's axes.
 * @param settings - User-space values by axis tag.
 */
export function normalizeCoordinates(
	reader: Reader,
	tables: Map<string, TableRecord>,
	axes: readonly Axis[],
	settings: Readonly<Record<string, number>>,
): number[] {
	let coords = axes.map((axis) => normalizeAxis(axis, settings[axis.tag]));
	let avar = tables.get("avar");
	if (avar === undefined || avar.length < 8 || reader.u16(avar.offset) !== 1) return coords;
	let end = avar.offset + avar.length;
	let at = avar.offset + 8;
	let count = Math.min(reader.u16(avar.offset + 6), coords.length);
	for (let axis = 0; axis < count; axis++) {
		let pairs = reader.u16(at);
		at += 2;
		if (at + pairs * 4 > end) break;
		coords[axis] = toF2dot14(mapSegment(reader, at, pairs, coords[axis] ?? 0));
		at += pairs * 4;
	}
	return coords;
}

/**
 * One axis value normalized, before `avar`. A value that is not a finite number reads as
 * the default.
 *
 * @param axis - The axis.
 * @param value - The user-space value, `undefined` for the default.
 */
function normalizeAxis(axis: Axis, value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return 0;
	let clamped = Math.min(Math.max(value, axis.min), axis.max);
	if (clamped < axis.default)
		return toF2dot14((clamped - axis.default) / (axis.default - axis.min));
	if (clamped > axis.default)
		return toF2dot14((clamped - axis.default) / (axis.max - axis.default));
	return 0;
}

/**
 * Applies one `avar` segment map by linear interpolation between the two pairs that bracket
 * the value; a map with fewer than two pairs, or one that never brackets it, maps it to itself.
 *
 * @param reader - The whole file.
 * @param at - Absolute offset of the first `(from, to)` pair.
 * @param pairs - How many pairs the map holds.
 * @param value - The normalized coordinate.
 */
function mapSegment(reader: Reader, at: number, pairs: number, value: number): number {
	if (pairs < 2) return value;
	let previousFrom = reader.f2dot14(at);
	let previousTo = reader.f2dot14(at + 2);
	if (value <= previousFrom) return previousTo;
	for (let pair = 1; pair < pairs; pair++) {
		let from = reader.f2dot14(at + pair * 4);
		let to = reader.f2dot14(at + pair * 4 + 2);
		if (value <= from) {
			if (from === previousFrom) return to;
			return previousTo + ((value - previousFrom) * (to - previousTo)) / (from - previousFrom);
		}
		previousFrom = from;
		previousTo = to;
	}
	return previousTo + (value - previousFrom);
}

/**
 * Rounds a normalized coordinate to the 2.14 grid the variation tables store theirs on, so
 * a scalar compares the same values a font tool compiled them from.
 *
 * @param value - A normalized coordinate.
 */
function toF2dot14(value: number): number {
	return Math.round(value * 16384) / 16384;
}

/**
 * A 16.16 fixed-point number.
 *
 * @param reader - The whole file.
 * @param offset - Absolute offset.
 */
function fixed(reader: Reader, offset: number): number {
	return (reader.u32(offset) | 0) / 65536;
}
