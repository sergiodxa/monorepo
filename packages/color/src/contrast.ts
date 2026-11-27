/**
 * WCAG 2.1 contrast math: relative luminance on linear sRGB and the pass flags at each
 * conformance level. The result names its algorithm, so a second one such as APCA can be
 * added beside it without changing what WCAG callers read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Vector } from "./spaces.js";

import { srgbToLinear } from "./spaces.js";

/** The contrast algorithms `Color#contrast` implements. */
export type ContrastAlgorithm = "WCAG21";

/**
 * A WCAG 2.1 contrast measurement. Every flag compares the unrounded ratio, as WCAG
 * requires, so 4.499:1 fails a 4.5:1 threshold.
 */
export interface WcagContrast {
	algorithm: "WCAG21";
	/** From 1 (identical luminance) to 21 (black on white). */
	ratio: number;
	/** Level AA: text at 4.5:1, large text at 3:1 and non-text UI (1.4.11) at 3:1. */
	aa: { text: boolean; largeText: boolean; nonText: boolean };
	/** Level AAA: text at 7:1 and large text at 4.5:1. */
	aaa: { text: boolean; largeText: boolean };
}

/** The WCAG 2.1 relative luminance of gamma-encoded sRGB, from 0 for black to 1 for white. */
export function relativeLuminance(rgb: Vector): number {
	return (
		0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2])
	);
}

/** The WCAG 2.1 contrast between two relative luminances, in either order. */
export function wcagContrast(first: number, second: number): WcagContrast {
	let ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
	return {
		algorithm: "WCAG21",
		ratio,
		aa: { text: ratio >= 4.5, largeText: ratio >= 3, nonText: ratio >= 3 },
		aaa: { text: ratio >= 7, largeText: ratio >= 4.5 },
	};
}
