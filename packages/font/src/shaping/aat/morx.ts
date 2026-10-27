/**
 * The AAT `morx` table (versions 2 and 3): chains of rearrangement, contextual, ligature,
 * noncontextual and insertion subtables, each run when the chain's feature flags select it.
 * Fonts built for Apple platforms describe their substitutions here instead of in GSUB.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRecord } from "../../font.js";
import type { Reader } from "../../reader.js";
import type { GlyphInfo } from "../glyph-info.js";
import type { ShapingFont } from "../shaping-font.js";

import type { AatFeature } from "./feat.js";

import { aatSelector, openTypeTag } from "./feature-map.js";
import { MorxProcessor } from "./subtables.js";

/** One feature entry of a chain: the flags a feature setting turns on and keeps. */
export interface MorxFeature {
	type: number;
	setting: number;
	enableFlags: number;
	disableFlags: number;
}

/** One subtable of a chain. */
export interface MorxSubtable {
	/** 0 rearrangement, 1 contextual, 2 ligature, 4 noncontextual, 5 insertion. */
	type: number;
	/** The coverage byte: vertical (`0x80`), descending (`0x40`), any orientation (`0x20`). */
	coverage: number;
	/** The chain flags any one of which enables the subtable. */
	subFeatureFlags: number;
	/** Absolute offset of the subtable's body, after its 12-byte header. */
	body: number;
	/** One past the subtable's last byte. */
	end: number;
}

/** One chain: its default flags, its feature entries and its subtables in order. */
export interface MorxChain {
	defaultFlags: number;
	features: MorxFeature[];
	subtables: MorxSubtable[];
}

/** A located `morx` table. */
export interface MorxTable {
	chains: MorxChain[];
}

/** Coverage bits of a subtable. */
const COVERAGE = { VERTICAL: 0x80, DESCENDING: 0x40, ANY_ORIENTATION: 0x20 };

/**
 * Locates a `morx` table's chains, their feature entries and subtables; a chain or subtable
 * whose length runs past the table ends the list.
 *
 * @param reader - The font bytes.
 * @param record - The `morx` directory entry.
 * @returns The table, `null` for a version other than 2 or 3.
 */
export function readMorx(reader: Reader, record: TableRecord): MorxTable | null {
	let { offset, length } = record;
	let version = reader.u16(offset);
	if (length < 8 || (version !== 2 && version !== 3)) return null;
	let end = offset + length;
	let chainCount = reader.u32(offset + 4);
	let chains: MorxChain[] = [];
	let at = offset + 8;
	for (let index = 0; index < chainCount && at + 16 <= end; index++) {
		let chainLength = reader.u32(at + 4);
		let featureCount = reader.u32(at + 8);
		let subtableCount = reader.u32(at + 12);
		let chainEnd = Math.min(at + chainLength, end);
		if (chainLength < 16) break;
		let features: MorxFeature[] = [];
		let cursor = at + 16;
		for (let item = 0; item < featureCount && cursor + 12 <= chainEnd; item++) {
			features.push({
				type: reader.u16(cursor),
				setting: reader.u16(cursor + 2),
				enableFlags: reader.u32(cursor + 4),
				disableFlags: reader.u32(cursor + 8),
			});
			cursor += 12;
		}
		let subtables: MorxSubtable[] = [];
		for (let item = 0; item < subtableCount && cursor + 12 <= chainEnd; item++) {
			let subtableLength = reader.u32(cursor);
			let coverage = reader.u32(cursor + 4);
			if (subtableLength < 12 || cursor + subtableLength > chainEnd) break;
			subtables.push({
				type: coverage & 0xff,
				coverage: coverage >>> 24,
				subFeatureFlags: reader.u32(cursor + 8),
				body: cursor + 12,
				end: cursor + subtableLength,
			});
			cursor += subtableLength;
		}
		chains.push({ defaultFlags: reader.u32(at), features, subtables });
		at += chainLength;
	}
	return { chains };
}

/**
 * The flags a chain runs with: its defaults, changed by each feature the caller turned on
 * or off. Turning off a selected setting of an exclusive type selects the type's default;
 * any other feature selects its "off" setting (the next odd one), else loses its flags.
 *
 * @param chain - The chain.
 * @param features - OpenType tags turned on (`true`) or off (`false`).
 * @param feat - The font's `feat` feature types, for exclusivity and defaults.
 */
export function chainFlags(
	chain: MorxChain,
	features: ReadonlyMap<string, boolean>,
	feat: ReadonlyMap<number, AatFeature>,
): number {
	let flags = chain.defaultFlags;
	let find = (type: number, setting: number) =>
		chain.features.find((entry) => entry.type === type && entry.setting === setting);
	let apply = (entry: MorxFeature | undefined) => {
		if (entry !== undefined) flags = ((flags & entry.disableFlags) | entry.enableFlags) >>> 0;
	};
	for (let [tag, on] of features) {
		let selector = aatSelector(tag);
		if (selector === null) continue;
		let { type, setting } = selector;
		if (on) {
			apply(find(type, setting));
			continue;
		}
		let described = feat.get(type);
		if (described?.exclusive === true) {
			let enable = find(type, setting)?.enableFlags ?? 0;
			if (enable !== 0 && (flags & enable) === enable) apply(find(type, described.defaultSetting));
			continue;
		}
		let off = find(type, setting + 1);
		if (off !== undefined && setting % 2 === 0) {
			apply(off);
			continue;
		}
		let entry = find(type, setting);
		if (entry !== undefined) flags = (flags & ~entry.enableFlags) >>> 0;
	}
	return flags;
}

/**
 * Runs every chain over the buffer, then drops the glyphs ligatures and substitutions
 * deleted. The buffer is in visual order, as the table expects.
 *
 * @param font - The shaping view.
 * @param morx - The font's `morx` table.
 * @param glyphs - The buffer, changed in place.
 * @param features - OpenType tags the caller turned on or off.
 * @param feat - The font's `feat` feature types.
 * @returns The OpenType tags of the features the chains ran with.
 */
export function applyMorx(
	font: ShapingFont,
	morx: MorxTable,
	glyphs: GlyphInfo[],
	features: ReadonlyMap<string, boolean>,
	feat: ReadonlyMap<number, AatFeature>,
): string[] {
	let processor = new MorxProcessor(font, glyphs);
	let applied = new Set<string>();
	for (let chain of morx.chains) {
		let flags = chainFlags(chain, features, feat);
		for (let entry of chain.features) {
			let tag = openTypeTag(entry.type, entry.setting);
			if (tag !== null && entry.enableFlags !== 0 && (entry.enableFlags & flags) !== 0) {
				applied.add(tag);
			}
		}
		for (let subtable of chain.subtables) {
			if ((subtable.subFeatureFlags & flags) === 0) continue;
			let vertical = (subtable.coverage & COVERAGE.VERTICAL) !== 0;
			if (vertical && (subtable.coverage & COVERAGE.ANY_ORIENTATION) === 0) continue;
			processor.run(subtable, (subtable.coverage & COVERAGE.DESCENDING) !== 0);
		}
	}
	processor.removeDeleted();
	return [...applied];
}

/**
 * The OpenType tags of every feature setting a `morx` table's chains offer, in chain order.
 *
 * @param morx - The table.
 */
export function morxFeatureTags(morx: MorxTable): string[] {
	let tags = new Set<string>();
	for (let chain of morx.chains) {
		for (let entry of chain.features) {
			let tag = openTypeTag(entry.type, entry.setting);
			if (tag !== null) tags.add(tag);
		}
	}
	return [...tags];
}
