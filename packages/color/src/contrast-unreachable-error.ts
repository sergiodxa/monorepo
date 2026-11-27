/**
 * The failure `Color#ensureContrast` reports when no lightness reaches the target ratio.
 * It carries the closest color it found, so a caller that must show something still has
 * the best available choice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Color } from "./color.js";

/** No OKLCH lightness of the color reaches `target` against the background. */
export class ContrastUnreachableError extends Error {
	/** The ratio that was asked for. */
	readonly target: number;
	/** The highest ratio any lightness reached, which `best` has. */
	readonly ratio: number;
	/** The color at the lightness extreme with the highest ratio, ready to use as a fallback. */
	readonly best: Color;

	/**
	 * @param target - The ratio that was asked for.
	 * @param ratio - The highest ratio reached.
	 * @param best - The color that reached it.
	 */
	constructor(target: number, ratio: number, best: Color) {
		super(`No lightness reaches a contrast of ${target}:1; the best is ${ratio.toFixed(2)}:1`);
		this.name = "ContrastUnreachableError";
		this.target = target;
		this.ratio = ratio;
		this.best = best;
	}
}
