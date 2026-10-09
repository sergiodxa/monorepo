/**
 * The SVG tree a diagram builds, as plain JSON: elements with string attributes
 * and text leaves. Every renderer reads this one shape, so a string, a component
 * tree and a cached payload all come from the same parse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** An SVG element. Attribute values are already strings, ready to write as they are. */
export interface SvgElement {
	type: "element";
	name: string;
	attributes: Record<string, string>;
	children: SvgNode[];
}

/** Character data, held unescaped; serializers escape it on the way out. */
export interface SvgText {
	type: "text";
	value: string;
}

export type SvgNode = SvgElement | SvgText;

/**
 * @param name - The SVG element name
 * @param attributes - Its attributes, written in insertion order
 * @param children - Its children, in order
 * @returns The element
 */
export function element(
	name: string,
	attributes: Record<string, string> = {},
	children: SvgNode[] = [],
): SvgElement {
	return { type: "element", name, attributes, children };
}

/**
 * Writes a coordinate with at most two decimals, which keeps the markup short
 * and identical across runs.
 *
 * @param value - A length in SVG user units
 * @returns The number as an attribute value
 */
export function num(value: number): string {
	let rounded = Math.round(value * 100) / 100;
	return String(Object.is(rounded, -0) ? 0 : rounded);
}
