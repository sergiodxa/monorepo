/**
 * Colors as callers write them, `#rrggbb`, turned into the operands of PDF's DeviceRGB
 * operators. A malformed color reads as black, so drawing keeps no failure path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { num } from "./objects.js";

/** A CSS-style hex color, `#rrggbb` or the short `#rgb`. */
export type Color = `#${string}`;

/**
 * The three DeviceRGB components between 0 and 1.
 *
 * @param color - A hex color; anything else reads as black.
 */
export function components(color: Color): [number, number, number] {
	let digits = color.slice(1);
	if (/^[\da-f]{3}$/i.test(digits)) digits = digits.replace(/./g, "$&$&");
	if (!/^[\da-f]{6}$/i.test(digits)) return [0, 0, 0];
	let value = Number.parseInt(digits, 16);
	return [(value >> 16) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

/**
 * The operator that sets the fill color, which text and filled shapes paint with.
 *
 * @param color - A hex color.
 * @example fill("#ff0000") // "1 0 0 rg"
 */
export function fill(color: Color): string {
	return `${components(color).map(num).join(" ")} rg`;
}

/**
 * The operator that sets the stroke color, which lines and outlines paint with.
 *
 * @param color - A hex color.
 */
export function stroke(color: Color): string {
	return `${components(color).map(num).join(" ")} RG`;
}
