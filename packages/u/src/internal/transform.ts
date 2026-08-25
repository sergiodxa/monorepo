/**
 * `transform` is a single CSS property, so two utilities that each set it
 * outright would overwrite each other when composed. Every transform utility
 * sets its own custom property (`--ui-translate-x`, `--ui-rotate`, ...) plus
 * one byte-identical composite `transform` value reading every variable with
 * an identity fallback, so whichever copy wins the cascade resolves them all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { var as varUtility } from "../general/var";

import type { CSSStyles } from "./css-styles";
import type { UtilityMixin } from "./descriptor";

import { utility } from "./descriptor";

/**
 * Each transform function's CSS custom property, as the bare name
 * {@link varUtility} prefixes with `--`.
 */
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
 * Builds a composable transform-function utility: sets the given
 * `--ui-{name}` custom properties plus the shared composite `transform`
 * declaration, so several transform utilities on one element combine.
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

/**
 * Resolves a scale factor: a bare number becomes a unitless factor, a string
 * (e.g. a percentage) passes through unchanged.
 */
export function scaleFactor(value: ScaleValue): string {
	return typeof value === "number" ? `${value}` : value;
}
