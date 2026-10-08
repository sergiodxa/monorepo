/**
 * TeX math to MathML Core, which browsers render natively with no stylesheet
 * or font. A recursive-descent parser reads a practical TeX subset into a JSON
 * tree of MathML elements, and a serializer writes that tree as markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { MathElement } from "./lib/tree.js";

import { MathError } from "./lib/errors.js";
import { parse } from "./lib/parser.js";
import { serialize } from "./lib/serialize.js";
import { element, row } from "./lib/tree.js";

export { MathError } from "./lib/errors.js";
export type { MathElement, MathNode, MathText } from "./lib/tree.js";

/** The MathML namespace, which the `math` element declares so XML consumers read it too. */
const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

/** Options for {@link parseMath} and {@link toMathML}. */
export interface MathOptions {
	/**
	 * A block formula: `display="block"`, with big operators' limits set under
	 * and over them instead of beside them.
	 *
	 * @default false
	 */
	display?: boolean;
}

/**
 * Reads TeX math into a MathML tree rooted at a `math` element. The formula sits
 * in a `semantics` element next to its TeX source as an annotation, which
 * assistive technology and copy-paste can read back.
 *
 * @param tex - TeX math, without the surrounding `$` or `\[`
 * @param options - Whether the formula is a block
 * @returns The tree, or the first construct outside the supported subset
 * @example parseMath("\\frac{a}{b}", { display: true })
 */
export function parseMath(tex: string, options: MathOptions = {}): Result<MathElement, MathError> {
	let display = options.display ?? false;
	let nodes;

	try {
		nodes = parse(tex, display);
	} catch (error) {
		if (error instanceof MathError) return failure(error);
		throw error;
	}

	let annotation = element("annotation", [{ type: "text", value: tex }], {
		encoding: "application/x-tex",
	});
	let semantics = element("semantics", [
		row(nodes.length === 0 ? [element("mrow")] : nodes),
		annotation,
	]);
	return success(
		element("math", [semantics], {
			xmlns: MATHML_NAMESPACE,
			display: display ? "block" : "inline",
		}),
	);
}

/**
 * Converts TeX math to a MathML string, safe to place in HTML or XHTML as it is.
 *
 * @param tex - TeX math, without the surrounding `$` or `\[`
 * @param options - Whether the formula is a block
 * @returns The markup, or the first construct outside the supported subset
 * @example toMathML("x^2") // '<math xmlns="…" display="inline"><semantics><msup>…'
 */
export function toMathML(tex: string, options: MathOptions = {}): Result<string, MathError> {
	let parsed = parseMath(tex, options);
	if (parsed.status === "failure") return parsed;
	return success(serialize(parsed.data));
}
