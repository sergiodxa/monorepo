/**
 * `backdrop-filter` is a single CSS property, so each utility sets its own
 * `--ui-backdrop-*` custom property plus one identical composite
 * `backdropFilter` declaration reading every variable with an identity
 * fallback. Custom properties from separate classes all apply, so the resolved
 * value carries every function any applied utility set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { var as varUtility } from "../general/var.js";

import type { CSSStyles } from "./css-styles.js";
import type { UtilityMixin } from "./descriptor.js";

import { utility } from "./descriptor.js";

/** The CSS custom property (without its leading `--`) each backdrop-filter function reads from. */
const BACKDROP_FILTER_VARS = {
	blur: "ui-backdrop-blur",
	brightness: "ui-backdrop-brightness",
	contrast: "ui-backdrop-contrast",
	grayscale: "ui-backdrop-grayscale",
	hueRotate: "ui-backdrop-hue-rotate",
	invert: "ui-backdrop-invert",
	opacity: "ui-backdrop-opacity",
	saturate: "ui-backdrop-saturate",
	sepia: "ui-backdrop-sepia",
	dropShadow: "ui-backdrop-drop-shadow",
} as const;

export type BackdropFilterFunctionName = keyof typeof BACKDROP_FILTER_VARS;

/**
 * The fixed, identical-everywhere `backdropFilter` value every backdrop-filter
 * utility emits. Backdrop-filter functions apply in sequence, so pinning one
 * shared order keeps composition predictable whatever order call sites use.
 */
export const COMPOSITE_BACKDROP_FILTER = [
	`blur(${varUtility(BACKDROP_FILTER_VARS.blur, "0px")})`,
	`brightness(${varUtility(BACKDROP_FILTER_VARS.brightness, "1")})`,
	`contrast(${varUtility(BACKDROP_FILTER_VARS.contrast, "1")})`,
	`grayscale(${varUtility(BACKDROP_FILTER_VARS.grayscale, "0")})`,
	`hue-rotate(${varUtility(BACKDROP_FILTER_VARS.hueRotate, "0deg")})`,
	`invert(${varUtility(BACKDROP_FILTER_VARS.invert, "0")})`,
	`opacity(${varUtility(BACKDROP_FILTER_VARS.opacity, "1")})`,
	`saturate(${varUtility(BACKDROP_FILTER_VARS.saturate, "1")})`,
	`sepia(${varUtility(BACKDROP_FILTER_VARS.sepia, "0")})`,
	`drop-shadow(${varUtility(BACKDROP_FILTER_VARS.dropShadow, "0 0 0 transparent")})`,
].join(" ");

/**
 * Builds a composable backdrop-filter-function utility: the given
 * `--ui-backdrop-{name}` properties, the shared composite declaration, and its
 * Safari `WebkitBackdropFilter` mirror, so utilities combine on one element.
 */
export function backdropFilterFunction<Node extends Element = Element>(
	values: Partial<Record<BackdropFilterFunctionName, string>>,
): UtilityMixin<Node> {
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		for (let name of Object.keys(values) as BackdropFilterFunctionName[]) {
			result[`--${BACKDROP_FILTER_VARS[name]}`] = values[name] as string;
		}
		result.backdropFilter = COMPOSITE_BACKDROP_FILTER;
		result.WebkitBackdropFilter = COMPOSITE_BACKDROP_FILTER;
		return result as CSSStyles;
	});
}
