/**
 * Reads the facts a font description for embedding needs: the bounding box, italic angle,
 * cap and x heights, weight, style flags and the `OS/2` embedding permission. Every field
 * is read by table length, so an old `OS/2` version or a missing `post` answers a default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font, TableRecord } from "./font.js";
import type { Reader } from "./reader.js";

/** What `readMetrics` answers, the style and permission fields a `Font` exposes. */
export interface FontMetrics {
	bbox: Font.BBox;
	italicAngle: number;
	capHeight: number | null;
	xHeight: number | null;
	weightClass: number;
	isFixedPitch: boolean;
	isItalic: boolean;
	isBold: boolean;
	isSerif: boolean;
	underlinePosition: number;
	underlineThickness: number;
	embedding: Font.Embedding;
}

/** `fsSelection` ITALIC and BOLD, and `macStyle` Bold and Italic. */
const FS_ITALIC = 0x0001;
const FS_BOLD = 0x0020;
const MAC_BOLD = 0x0001;
const MAC_ITALIC = 0x0002;

/** `fsType` usage bits in order of increasing restriction, and the two option bits. */
const FS_TYPE_EDITABLE = 0x0008;
const FS_TYPE_PREVIEW_AND_PRINT = 0x0004;
const FS_TYPE_RESTRICTED = 0x0002;
const FS_TYPE_NO_SUBSETTING = 0x0100;
const FS_TYPE_BITMAP_ONLY = 0x0200;

/** IBM font classes in `sFamilyClass`'s high byte that are serif designs. */
const SERIF_CLASSES = new Set([1, 2, 3, 4, 5, 7]);

/**
 * Reads the metrics and style of a font whose required tables `parseFont` already checked.
 *
 * @param reader - The font bytes.
 * @param head - The `head` table, at least 54 bytes.
 * @param os2 - The `OS/2` table, when the font has one.
 * @param post - The `post` table, when the font has one.
 */
export function readMetrics(
	reader: Reader,
	head: TableRecord,
	os2: TableRecord | undefined,
	post: TableRecord | undefined,
): FontMetrics {
	let macStyle = reader.u16(head.offset + 44);
	let os2At = (field: number, size: number) =>
		os2 !== undefined && os2.length >= field + size ? os2.offset + field : null;
	let postAt = (field: number, size: number) =>
		post !== undefined && post.length >= field + size ? post.offset + field : null;

	let version = os2At(0, 2) === null ? 0 : reader.u16(os2?.offset ?? 0);
	let weight = os2At(4, 2);
	let fsType = os2At(8, 2);
	let familyClass = os2At(30, 2);
	let fsSelection = os2At(62, 2);
	let xHeight = version >= 2 ? os2At(86, 2) : null;
	let capHeight = version >= 2 ? os2At(88, 2) : null;
	let selection = fsSelection === null ? 0 : reader.u16(fsSelection);

	let italicAngle = postAt(4, 4);
	let underlinePosition = postAt(8, 2);
	let underlineThickness = postAt(10, 2);
	let fixedPitch = postAt(12, 4);

	return {
		bbox: {
			xMin: reader.i16(head.offset + 36),
			yMin: reader.i16(head.offset + 38),
			xMax: reader.i16(head.offset + 40),
			yMax: reader.i16(head.offset + 42),
		},
		italicAngle:
			italicAngle === null ? 0 : reader.i16(italicAngle) + reader.u16(italicAngle + 2) / 65536,
		capHeight: capHeight === null ? null : reader.i16(capHeight),
		xHeight: xHeight === null ? null : reader.i16(xHeight),
		weightClass: weight === null || reader.u16(weight) === 0 ? 400 : reader.u16(weight),
		isFixedPitch: fixedPitch !== null && reader.u32(fixedPitch) !== 0,
		isItalic: ((selection & FS_ITALIC) | (macStyle & MAC_ITALIC)) !== 0,
		isBold: ((selection & FS_BOLD) | (macStyle & MAC_BOLD)) !== 0,
		isSerif: familyClass !== null && SERIF_CLASSES.has(reader.u8(familyClass)),
		underlinePosition: underlinePosition === null ? 0 : reader.i16(underlinePosition),
		underlineThickness: underlineThickness === null ? 0 : reader.i16(underlineThickness),
		embedding: embeddingOf(fsType === null ? 0 : reader.u16(fsType)),
	};
}

/**
 * Decodes `fsType`. A font that sets more than one usage bit gets the least restrictive one
 * it sets, the precedence the OpenType specification gives, and bit 0, which is reserved,
 * grants installable embedding on its own.
 *
 * @param fsType - `OS/2.fsType`, `0` for a font without `OS/2`.
 */
function embeddingOf(fsType: number): Font.Embedding {
	let allowed: Font.EmbeddingLevel = "installable";
	if (fsType & FS_TYPE_EDITABLE) allowed = "editable";
	else if (fsType & FS_TYPE_PREVIEW_AND_PRINT) allowed = "preview-and-print";
	else if (fsType & FS_TYPE_RESTRICTED) allowed = "restricted";
	return {
		allowed,
		subsetting: (fsType & FS_TYPE_NO_SUBSETTING) === 0,
		bitmapOnly: (fsType & FS_TYPE_BITMAP_ONLY) !== 0,
	};
}
