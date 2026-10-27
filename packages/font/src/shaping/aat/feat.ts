/**
 * The AAT `feat` table: the feature types a font offers, each with its settings, their names
 * in `name`, whether the settings exclude each other, and which one is on by default. Turning
 * an exclusive feature off selects its default setting again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRecord } from "../../font.js";
import type { Reader } from "../../reader.js";

/** One setting of an AAT feature type. */
export interface AatSetting {
	setting: number;
	/** The `name` table entry naming the setting. */
	nameId: number;
}

/** One AAT feature type as `feat` describes it. */
export interface AatFeature {
	type: number;
	/** The `name` table entry naming the feature type. */
	nameId: number;
	/** Whether exactly one setting is on at a time, like radio buttons. */
	exclusive: boolean;
	/** The setting on by default for an exclusive type, the first setting otherwise. */
	defaultSetting: number;
	settings: AatSetting[];
}

/** `featureFlags` bits. */
const FLAG = { EXCLUSIVE: 0x8000, HAS_DEFAULT_INDEX: 0x4000, DEFAULT_INDEX: 0x00ff };

/**
 * The feature types `feat` lists, by type; empty for a table of another version.
 *
 * @param reader - The font bytes.
 * @param record - The `feat` table's directory entry.
 */
export function readFeat(reader: Reader, record: TableRecord): Map<number, AatFeature> {
	let features = new Map<number, AatFeature>();
	let { offset, length } = record;
	if (length < 12 || reader.u16(offset) !== 1) return features;
	let count = reader.u16(offset + 4);
	let end = offset + length;
	for (let index = 0; index < count; index++) {
		let at = offset + 12 + index * 12;
		if (at + 12 > end) break;
		let type = reader.u16(at);
		let settingCount = reader.u16(at + 2);
		let settingsAt = offset + reader.u32(at + 4);
		let flags = reader.u16(at + 8);
		let settings: AatSetting[] = [];
		for (let item = 0; item < settingCount; item++) {
			let entry = settingsAt + item * 4;
			if (entry + 4 > end) break;
			settings.push({ setting: reader.u16(entry), nameId: reader.u16(entry + 2) });
		}
		let defaultIndex = (flags & FLAG.HAS_DEFAULT_INDEX) === 0 ? 0 : flags & FLAG.DEFAULT_INDEX;
		features.set(type, {
			type,
			nameId: reader.i16(at + 10),
			exclusive: (flags & FLAG.EXCLUSIVE) !== 0,
			defaultSetting: settings[defaultIndex]?.setting ?? settings[0]?.setting ?? 0,
			settings,
		});
	}
	return features;
}
