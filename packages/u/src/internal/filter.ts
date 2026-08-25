/**
 * `filter` is a single CSS property, so each utility sets its own
 * `--ui-filter-*` custom property plus one identical composite `filter`
 * declaration reading every variable with an identity fallback. Custom
 * properties from separate classes all apply, so the resolved value carries
 * every function any applied utility set, and identity defaults elsewhere.
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
 * Filter functions apply in sequence, so pinning the CSS-defined order here
 * makes composition predictable whatever order a call site lists utilities in.
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
 * Builds a composable filter-function utility: sets the given
 * `--ui-filter-{name}` custom properties plus the shared composite `filter`
 * declaration, so filter utilities on one element combine every function.
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
