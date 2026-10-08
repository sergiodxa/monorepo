/**
 * The MathML tree a conversion builds, as plain JSON: elements with string
 * attributes and text leaves. Every renderer reads this one shape, so a string,
 * a component tree and a cached payload all come from the same parse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A MathML element. Attribute values are already strings, ready to write as they are. */
export interface MathElement {
	type: "element";
	name: string;
	attributes: Record<string, string>;
	children: MathNode[];
}

/** Character data, held unescaped; serializers escape it on the way out. */
export interface MathText {
	type: "text";
	value: string;
}

export type MathNode = MathElement | MathText;

/**
 * @param name - The MathML element name
 * @param children - Its children, in order
 * @param attributes - Its attributes, written in insertion order
 * @returns The element
 */
export function element(
	name: string,
	children: MathNode[] = [],
	attributes: Record<string, string> = {},
): MathElement {
	return { type: "element", name, attributes, children };
}

/**
 * A token element holding one run of text, which is what `mi`, `mn`, `mo` and
 * `mtext` always are.
 *
 * @param name - The token element name
 * @param value - Its text
 * @param attributes - Its attributes
 * @returns The element
 */
export function token(
	name: string,
	value: string,
	attributes: Record<string, string> = {},
): MathElement {
	return element(name, [{ type: "text", value }], attributes);
}

/**
 * Groups a run of nodes as one, collapsing a single node to itself so a braced
 * group around one symbol adds no `mrow`.
 *
 * @param nodes - The run to group
 * @returns The lone node, or an `mrow` holding the run
 */
export function row(nodes: MathNode[]): MathNode {
	if (nodes.length === 1) return nodes[0] as MathNode;
	return element("mrow", nodes);
}
