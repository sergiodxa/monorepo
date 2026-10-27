/**
 * Feature parameters: the user-interface names a font gives its stylistic sets and
 * character variants, and the design size range of `size`, read from GSUB and GPOS feature
 * tables, so an application can label a feature menu with the font's own words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";

import type { Feature, LayoutTable } from "./layout-table.js";
import type { ShapingFont } from "./shaping-font.js";

import { feature, featureCount } from "./layout-table.js";
import { shapingFont } from "./shaping-font.js";

/** A stylistic set's name (`ss01`–`ss20`). */
export interface StylisticSetParams {
	kind: "stylistic-set";
	version: number;
	/** `name` table ID of the set's user-interface name. */
	nameId: number;
}

/** A character variant's names and the characters it applies to (`cv01`–`cv99`). */
export interface CharacterVariantParams {
	kind: "character-variant";
	format: number;
	/** `name` IDs, `0` when the font gives none. */
	labelNameId: number;
	tooltipNameId: number;
	sampleTextNameId: number;
	/** `name` ID of the first variant's label; the rest follow consecutively. */
	firstParamLabelNameId: number;
	/** How many variants have labels. */
	namedParameters: number;
	/** The Unicode characters the variants apply to. */
	characters: number[];
}

/** The design size and the size range a `size` feature recommends the font for, in decipoints. */
export interface SizeParams {
	kind: "size";
	designSize: number;
	subfamilyId: number;
	subfamilyNameId: number;
	rangeStart: number;
	rangeEnd: number;
}

/** The parameters of a feature, by the kind its tag implies. */
export type FeatureParams = StylisticSetParams | CharacterVariantParams | SizeParams;

/**
 * The parameters a font records for a feature: names for `ssXX` and `cvXX`, sizes for
 * `size`. GSUB is searched first, then GPOS.
 *
 * @param font - A font from `parseFont`.
 * @param tag - A feature tag.
 * @returns The parameters, or `null` when the font lacks the feature or gives it none.
 * @example featureParams(font, "ss01")?.nameId // 257
 */
export function featureParams(font: Font, tag: string): FeatureParams | null {
	let shaping = shapingFont(font);
	for (let table of [shaping.gsub, shaping.gpos]) {
		if (table === null) continue;
		let found = findFeature(table, tag);
		if (found === null || found.params === 0) continue;
		return readParams(shaping, found);
	}
	return null;
}

/**
 * The first feature record with a tag.
 *
 * @param table - A GSUB or GPOS table.
 * @param tag - A feature tag.
 */
function findFeature(table: LayoutTable, tag: string): Feature | null {
	let count = featureCount(table);
	for (let index = 0; index < count; index++) {
		let found = feature(table, index);
		if (found?.tag === tag) return found;
	}
	return null;
}

/**
 * Decodes the parameter table the feature's tag calls for.
 *
 * @param font - The shaping view.
 * @param found - The feature.
 */
function readParams(font: ShapingFont, found: Feature): FeatureParams | null {
	let { reader } = font;
	let at = found.params;
	if (/^ss(0[1-9]|1\d|20)$/.test(found.tag)) {
		return { kind: "stylistic-set", version: reader.u16(at), nameId: reader.u16(at + 2) };
	}
	if (/^cv\d\d$/.test(found.tag)) {
		let count = reader.u16(at + 12);
		let characters: number[] = [];
		for (let index = 0; index < count; index++) {
			let character = at + 14 + index * 3;
			characters.push((reader.u8(character) << 16) | reader.u16(character + 1));
		}
		return {
			kind: "character-variant",
			format: reader.u16(at),
			labelNameId: reader.u16(at + 2),
			tooltipNameId: reader.u16(at + 4),
			sampleTextNameId: reader.u16(at + 6),
			namedParameters: reader.u16(at + 8),
			firstParamLabelNameId: reader.u16(at + 10),
			characters,
		};
	}
	if (found.tag === "size") {
		return {
			kind: "size",
			designSize: reader.u16(at),
			subfamilyId: reader.u16(at + 2),
			subfamilyNameId: reader.u16(at + 4),
			rangeStart: reader.u16(at + 6),
			rangeEnd: reader.u16(at + 8),
		};
	}
	return null;
}
