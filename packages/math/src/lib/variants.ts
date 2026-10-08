/**
 * Applies a font command to the tree its argument parsed into. MathML Core
 * styles only through `mathvariant="normal"`, so bold, italic and double-struck
 * letters become their Unicode Mathematical Alphanumeric Symbols instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MathNode } from "./tree.js";

import { element, row } from "./tree.js";

/** The styles a font command selects. */
export type Variant = "normal" | "bold" | "italic" | "double-struck";

/**
 * Where each styled alphabet starts in the Mathematical Alphanumeric Symbols
 * block, and the letters Unicode encoded earlier in Letterlike Symbols, which
 * leave a hole in that block.
 */
const ALPHABETS: Record<
	Exclude<Variant, "normal">,
	{ upper: number; lower: number; digits?: number; holes: Record<string, number> }
> = {
	bold: { upper: 0x1d400, lower: 0x1d41a, digits: 0x1d7ce, holes: {} },
	italic: { upper: 0x1d434, lower: 0x1d44e, holes: { h: 0x210e } },
	"double-struck": {
		upper: 0x1d538,
		lower: 0x1d552,
		digits: 0x1d7d8,
		holes: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
	},
};

/**
 * @param node - The argument of a font command, as parsed
 * @param variant - The style the command selects
 * @returns The same formula with its identifiers and numbers in that style
 */
export function applyVariant(node: MathNode, variant: Variant): MathNode {
	if (variant === "normal") return upright(node);
	return restyle(node, variant);
}

/**
 * Upright text in TeX's sense: adjacent letters read as one word, which a
 * multi-letter `mi` already draws upright, and a lone letter says so explicitly.
 */
function upright(node: MathNode): MathNode {
	if (node.type === "text") return node;

	if (node.name === "mi" && isSingleCharacter(node)) {
		return { ...node, attributes: { ...node.attributes, mathvariant: "normal" } };
	}

	if (node.name === "mrow") return row(mergeIdentifiers(node.children).map(upright));
	return { ...node, children: node.children.map(upright) };
}

/** Joins runs of plain single-letter identifiers into one, so `\mathrm{max}` is the word "max". */
function mergeIdentifiers(children: MathNode[]): MathNode[] {
	let merged: MathNode[] = [];

	for (let child of children) {
		let previous = merged.at(-1);
		if (isPlainIdentifier(child) && previous && isPlainIdentifier(previous)) {
			merged[merged.length - 1] = element("mi", [
				{ type: "text", value: textOf(previous) + textOf(child) },
			]);
			continue;
		}
		merged.push(child);
	}

	return merged;
}

/** An `mi` whose letters carry no style yet, which is what merging may combine. */
function isPlainIdentifier(node: MathNode): boolean {
	return (
		node.type === "element" &&
		node.name === "mi" &&
		Object.keys(node.attributes).length === 0 &&
		/^\p{L}+$/u.test(textOf(node))
	);
}

/** Maps every letter and digit inside identifiers and numbers to the styled alphabet. */
function restyle(node: MathNode, variant: Exclude<Variant, "normal">): MathNode {
	if (node.type === "text") return node;

	if (node.name === "mi" || node.name === "mn") {
		let value = Array.from(textOf(node), (character) => styled(character, variant)).join("");
		return { ...node, children: [{ type: "text", value }] };
	}

	return { ...node, children: node.children.map((child) => restyle(child, variant)) };
}

/** One character in the styled alphabet, or unchanged when that alphabet has no such character. */
function styled(character: string, variant: Exclude<Variant, "normal">): string {
	let alphabet = ALPHABETS[variant];
	let hole = alphabet.holes[character];
	if (hole !== undefined) return String.fromCodePoint(hole);

	let code = character.charCodeAt(0);
	if (code >= 65 && code <= 90) return String.fromCodePoint(alphabet.upper + code - 65);
	if (code >= 97 && code <= 122) return String.fromCodePoint(alphabet.lower + code - 97);
	if (code >= 48 && code <= 57 && alphabet.digits !== undefined) {
		return String.fromCodePoint(alphabet.digits + code - 48);
	}
	return character;
}

/** The text a token element holds. */
function textOf(node: MathNode): string {
	if (node.type === "text") return node.value;
	return node.children.map(textOf).join("");
}

/** A lone code point, which is the case browsers italicize by default. */
function isSingleCharacter(node: MathNode): boolean {
	return Array.from(textOf(node)).length === 1;
}
