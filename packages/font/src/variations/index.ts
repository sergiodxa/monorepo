/**
 * Variable fonts, the `@sdxc/font/variations` entry: list a font's axes and named instances,
 * and fix it at a point of its design space with `instance(font, { wght: 700 })`, which
 * answers a `Font` whose outlines, advances and metrics are those of that instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { FontData } from "../font.js";

import { FontError } from "../font-error.js";
import { Font, fontData } from "../font.js";

import type { Axis, NamedInstance } from "./fvar.js";
import type { VariedFontData } from "./variation.js";

import { normalizeCoordinates, readAxes, readNamedInstances } from "./fvar.js";
import { FontVariation, metricDeltas, variationOf } from "./variation.js";

export type { Axis, NamedInstance } from "./fvar.js";

/**
 * The font's design axes in `fvar` order; a font that is not variable has none.
 *
 * @param font - A font from `parseFont`, or an instance of one.
 * @example axes(font).map(({ tag, min, max }) => `${tag} ${min}–${max}`)
 */
export function axes(font: Font): Axis[] {
	let data = baseData(font);
	return readAxes(data.reader, data.tables);
}

/**
 * The font's named instances ("Bold", "Condensed Light") in `fvar` order, each with the
 * value of every axis.
 *
 * @param font - A font from `parseFont`, or an instance of one.
 * @example namedInstances(font).map(({ name }) => name)
 */
export function namedInstances(font: Font): NamedInstance[] {
	let data = baseData(font);
	return readNamedInstances(data.reader, data.tables, readAxes(data.reader, data.tables));
}

/**
 * The font fixed at one point of its design space. Axes `settings` leaves out sit at their
 * default and values are clamped to each axis's range; a name picks a named instance, whose
 * name and PostScript name the result reports. Instancing an instance starts from the default.
 *
 * @param font - A variable font.
 * @param settings - User-space values by axis tag, or a named instance's name.
 * @returns The instance, or a `FontError` with code `unsupported` when the font has no
 *   `fvar` axes or no named instance by that name.
 * @example let bold = unwrap(instance(font, { wght: 700 }));
 * @example let condensed = unwrap(instance(font, "Condensed"));
 */
export function instance(
	font: Font,
	settings: Readonly<Record<string, number>> | string,
): Result<Font, FontError> {
	let base = baseData(font);
	let fontAxes = readAxes(base.reader, base.tables);
	if (fontAxes.length === 0) {
		return failure(new FontError("unsupported", "The font is not a variable font.", "fvar"));
	}
	let named: NamedInstance | null = null;
	let requested = settings;
	if (typeof requested === "string") {
		let name = requested;
		named =
			readNamedInstances(base.reader, base.tables, fontAxes).find(
				(candidate) => candidate.name === name || candidate.postscriptName === name,
			) ?? null;
		if (named === null) {
			return failure(new FontError("unsupported", `The font has no instance "${name}".`, "fvar"));
		}
		requested = named.coordinates;
	}

	let values: Record<string, number> = {};
	for (let axis of fontAxes) {
		let value = requested[axis.tag];
		values[axis.tag] =
			value === undefined || !Number.isFinite(value)
				? axis.default
				: Math.min(Math.max(value, axis.min), axis.max);
	}
	let coords = normalizeCoordinates(base.reader, base.tables, fontAxes, values);
	let variation = new FontVariation(base, values, coords);
	let metrics = metricDeltas(base, coords);
	let delta = (tag: string): number => Math.round(metrics.get(tag) ?? 0);
	let weight = values.wght;
	let data: VariedFontData = {
		...base,
		ascender: base.ascender + delta("hasc"),
		descender: base.descender + delta("hdsc"),
		lineGap: base.lineGap + delta("hlgn"),
		capHeight: base.capHeight === null ? null : base.capHeight + delta("cpht"),
		xHeight: base.xHeight === null ? null : base.xHeight + delta("xhgt"),
		underlinePosition: base.underlinePosition + delta("undo"),
		underlineThickness: base.underlineThickness + delta("unds"),
		weightClass:
			weight === undefined ? base.weightClass : Math.min(Math.max(Math.round(weight), 1), 1000),
		subfamily: named === null || named.name === "" ? base.subfamily : named.name,
		postscriptName: named?.postscriptName ?? base.postscriptName,
		variation,
	};
	return success(new Font(data));
}

/**
 * The data of the font at its default location: an instance's base, or the font's own.
 *
 * @param font - A font, instanced or not.
 */
function baseData(font: Font): FontData {
	let data = fontData(font);
	return variationOf(data)?.base ?? data;
}
