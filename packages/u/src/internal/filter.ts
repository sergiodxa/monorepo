/**
 * `filter` is a single CSS property, so two independent utilities that each
 * set it outright (`filter: blur(...)`, `filter: grayscale(...)`) would
 * silently overwrite each other when composed on the same element instead of
 * combining — the exact same problem `internal/transform.ts` solves for
 * `transform` and `internal/backdrop-filter.ts` for `backdrop-filter`. Every
 * filter utility instead sets its own CSS custom property (`--ui-filter-blur`,
 * `--ui-filter-grayscale`, ...) and the exact same fixed `filter` declaration,
 * one composite expression referencing every filter function's variable with
 * an identity fallback (`0px`, `1`, `0`, ...). Custom properties from separate
 * classes on the same element all apply simultaneously — only the *value* text
 * of `filter` matters for the cascade, and since that text is identical across
 * every filter utility, it doesn't matter which one's copy of it "wins"; the
 * resolved `filter` always reads every variable any applied utility set, and
 * identity defaults for every variable none of them touched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { var as varUtility } from "../general/var";

import type { CSSStyles } from "./css-styles";
import type { UtilityMixin } from "./descriptor";

import { utility } from "./descriptor";

/** The CSS custom property (without its leading `--`) each filter function reads from. */
const FILTER_VARS = {
	blur: "ui-filter-blur",
	brightness: "ui-filter-brightness",
	contrast: "ui-filter-contrast",
	grayscale: "ui-filter-grayscale",
	hueRotate: "ui-filter-hue-rotate",
	invert: "ui-filter-invert",
	opacity: "ui-filter-opacity",
	saturate: "ui-filter-saturate",
	sepia: "ui-filter-sepia",
	dropShadow: "ui-filter-drop-shadow",
} as const;

export type FilterFunctionName = keyof typeof FILTER_VARS;

/**
 * The fixed, identical-everywhere `filter` value every filter utility emits.
 * The function order is the one CSS applies them in, so a `grayscale` always
 * lands after a `brightness` regardless of which utility a call site listed
 * first — filter functions are not commutative, and pinning the order here is
 * what makes the composition predictable.
 */
export const COMPOSITE_FILTER = [
	`blur(${varUtility(FILTER_VARS.blur, "0px")})`,
	`brightness(${varUtility(FILTER_VARS.brightness, "1")})`,
	`contrast(${varUtility(FILTER_VARS.contrast, "1")})`,
	`grayscale(${varUtility(FILTER_VARS.grayscale, "0")})`,
	`hue-rotate(${varUtility(FILTER_VARS.hueRotate, "0deg")})`,
	`invert(${varUtility(FILTER_VARS.invert, "0")})`,
	`opacity(${varUtility(FILTER_VARS.opacity, "1")})`,
	`saturate(${varUtility(FILTER_VARS.saturate, "1")})`,
	`sepia(${varUtility(FILTER_VARS.sepia, "0")})`,
	`drop-shadow(${varUtility(FILTER_VARS.dropShadow, "0 0 0 transparent")})`,
].join(" ");

/**
 * Builds a composable filter-function utility: sets the specific
 * `--ui-filter-{name}` custom property (or properties) given, plus the shared
 * composite `filter` declaration, so calling more than one filter utility on
 * the same element combines every function instead of the last one
 * overwriting the rest.
 */
export function filterFunction<Node extends Element = Element>(
	values: Partial<Record<FilterFunctionName, string>>,
): UtilityMixin<Node> {
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		for (let name of Object.keys(values) as FilterFunctionName[]) {
			result[`--${FILTER_VARS[name]}`] = values[name] as string;
		}
		result.filter = COMPOSITE_FILTER;
		return result as CSSStyles;
	});
}
