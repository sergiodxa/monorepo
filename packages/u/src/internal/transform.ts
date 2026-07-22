import { var as varUtility } from "../general/var";

/**
 * `transform` is a single CSS property, so two independent utilities that
 * each set it outright (`transform: translateX(...)`, `transform:
 * rotate(...)`) would silently overwrite each other when composed on the
 * same element instead of combining. Every transform utility instead sets
 * its own CSS custom property (`--ui-translate-x`, `--ui-rotate`, ...) and
 * the exact same fixed `transform` declaration, one composite expression
 * referencing every transform function's variable with an identity
 * fallback (`0`, `0deg`, `1`, ...). Custom properties from separate classes
 * on the same element all apply simultaneously — only the *value* text of
 * `transform` matters for the cascade, and since that text is identical
 * across every transform utility, it doesn't matter which one's copy of it
 * "wins"; the resolved `transform` always reads every variable any applied
 * utility set, and defaults for every variable no utility touched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "./css-styles";
import type { UtilityMixin } from "./descriptor";

import { utility } from "./descriptor";

/** The CSS custom property (without its leading `--`) each transform function reads from. */
const TRANSFORM_VARS = {
	translateX: "ui-translate-x",
	translateY: "ui-translate-y",
	rotate: "ui-rotate",
	rotateX: "ui-rotate-x",
	rotateY: "ui-rotate-y",
	scaleX: "ui-scale-x",
	scaleY: "ui-scale-y",
	skewX: "ui-skew-x",
	skewY: "ui-skew-y",
} as const;

export type TransformFunctionName = keyof typeof TRANSFORM_VARS;

/** The fixed, identical-everywhere `transform` value every transform utility emits. */
export const COMPOSITE_TRANSFORM = [
	`translate(${varUtility(TRANSFORM_VARS.translateX, "0")}, ${varUtility(TRANSFORM_VARS.translateY, "0")})`,
	`rotate(${varUtility(TRANSFORM_VARS.rotate, "0deg")})`,
	`rotateX(${varUtility(TRANSFORM_VARS.rotateX, "0deg")})`,
	`rotateY(${varUtility(TRANSFORM_VARS.rotateY, "0deg")})`,
	`scale(${varUtility(TRANSFORM_VARS.scaleX, "1")}, ${varUtility(TRANSFORM_VARS.scaleY, "1")})`,
	`skew(${varUtility(TRANSFORM_VARS.skewX, "0deg")}, ${varUtility(TRANSFORM_VARS.skewY, "0deg")})`,
].join(" ");

/**
 * Builds a composable transform-function utility: sets the specific
 * `--ui-{name}` custom property (or properties) given, plus the shared
 * composite `transform` declaration, so calling more than one transform
 * utility on the same element combines every function instead of the last
 * one overwriting the rest.
 */
export function transformFunction<Node extends Element = Element>(
	values: Partial<Record<TransformFunctionName, string>>,
): UtilityMixin<Node> {
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		for (let name of Object.keys(values) as TransformFunctionName[]) {
			result[`--${TRANSFORM_VARS[name]}`] = values[name] as string;
		}
		result.transform = COMPOSITE_TRANSFORM;
		return result as CSSStyles;
	});
}

export type AngleValue = number | (string & {});

/** Resolves an angle: a bare number is treated as degrees, a string passes through unchanged. */
export function angle(value: AngleValue): string {
	return typeof value === "number" ? `${value}deg` : value;
}

export type ScaleValue = number | (string & {});

/** Resolves a scale factor: a bare number passes through as a unitless factor, a string (e.g. a percentage) passes through unchanged. */
export function scaleFactor(value: ScaleValue): string {
	return typeof value === "number" ? `${value}` : value;
}
