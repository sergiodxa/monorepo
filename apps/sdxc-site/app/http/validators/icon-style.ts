/**
 * Reads an icon customization from a query string, so a shared address renders what its
 * author saw. Each field is checked on its own: one out of range or malformed falls back to
 * the default and leaves the rest, since a hand-edited link deserves the parts that hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { enum_, parseSafe, string } from "remix/data-schema";
import { max, min } from "remix/data-schema/checks";
import { number as coerceNumber } from "remix/data-schema/coerce";

import type { IconStyle } from "~/app/services/icon-style";

import {
	DEFAULT_ICON_STYLE,
	ICON_STYLE_PARAMS,
	ICON_STYLE_RANGES,
} from "~/app/services/icon-style";

/** A size within the slider's range. */
const SizeSchema = coerceNumber().pipe(
	min(ICON_STYLE_RANGES.size.min),
	max(ICON_STYLE_RANGES.size.max),
);

/** A stroke width within the slider's range. */
const StrokeWidthSchema = coerceNumber().pipe(
	min(ICON_STYLE_RANGES.strokeWidth.min),
	max(ICON_STYLE_RANGES.strokeWidth.max),
);

/** How a set absolute stroke arrives: `1` from an address, `on` from the form's checkbox. */
const AbsoluteSchema = enum_(["1", "on", "true"]);

/** A six-digit hex colour, the only form a colour input produces. */
const ColorSchema = string().refine((value) => /^#[0-9a-f]{6}$/i.test(value));

/** The customization `params` names, with the default for every field that is absent or invalid. */
export function readIconStyle(params: URLSearchParams): IconStyle {
	return {
		size: field(SizeSchema, params.get(ICON_STYLE_PARAMS.size), DEFAULT_ICON_STYLE.size),
		strokeWidth: field(
			StrokeWidthSchema,
			params.get(ICON_STYLE_PARAMS.strokeWidth),
			DEFAULT_ICON_STYLE.strokeWidth,
		),
		absoluteStrokeWidth:
			field(AbsoluteSchema, params.get(ICON_STYLE_PARAMS.absoluteStrokeWidth), null) !== null,
		color: field(ColorSchema, params.get(ICON_STYLE_PARAMS.color), null)?.toLowerCase() ?? null,
	};
}

/** One parameter's value, or `fallback` when it is absent or fails `schema`. */
function field<T>(
	schema: Parameters<typeof parseSafe<unknown, T>>[0],
	raw: string | null,
	fallback: T,
): T {
	if (raw === null || raw === "") return fallback;
	let result = parseSafe(schema, raw);
	return result.success ? result.value : fallback;
}
