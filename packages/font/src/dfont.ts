/**
 * Mac `dfont` files: a resource fork stored in the data fork, holding each font as an
 * `sfnt` resource. Locating those resources is all a dfont needs, since each one is a
 * complete sfnt whose table offsets count from the resource's own start.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Reader } from "./reader.js";

/** A resource's bytes inside the file. */
export interface ResourceSpan {
	offset: number;
	length: number;
}

/**
 * The `sfnt` resources of a resource fork, in the order its reference list holds them.
 *
 * @param reader - The whole file.
 * @returns Each font's span, or `null` when the bytes are not a resource fork with at least
 *   one `sfnt` resource, which is how a dfont is told from other files.
 */
export function dfontFonts(reader: Reader): ResourceSpan[] | null {
	if (reader.length < 16) return null;
	let dataOffset = reader.u32(0);
	let mapOffset = reader.u32(4);
	let dataLength = reader.u32(8);
	let mapLength = reader.u32(12);
	if (dataOffset < 16 || dataOffset + dataLength > reader.length) return null;
	if (mapLength < 30 || mapOffset + mapLength > reader.length) return null;

	let typeList = mapOffset + reader.u16(mapOffset + 24);
	let typeCount = reader.u16(typeList) + 1;
	for (let index = 0; index < typeCount; index++) {
		let type = typeList + 2 + index * 8;
		if (type + 8 > mapOffset + mapLength) return null;
		if (reader.tag(type) !== "sfnt") continue;
		let count = reader.u16(type + 4) + 1;
		let references = typeList + reader.u16(type + 6);
		if (references + count * 12 > mapOffset + mapLength) return null;
		let fonts: ResourceSpan[] = [];
		for (let font = 0; font < count; font++) {
			let reference = references + font * 12;
			let start =
				dataOffset +
				(reader.u8(reference + 5) << 16) +
				(reader.u8(reference + 6) << 8) +
				reader.u8(reference + 7);
			let length = reader.u32(start);
			if (start + 4 + length > dataOffset + dataLength) return null;
			fonts.push({ offset: start + 4, length });
		}
		return fonts;
	}
	return null;
}
