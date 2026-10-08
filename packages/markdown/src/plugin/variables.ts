/**
 * A `Markdown.walk` visitor that fills a document's variables from one set of values:
 * the `{% $name %}` holes in text and the `{$name}` ones in attribute values, a dotted
 * `$plan.price` read through objects and arrays. A tag whose schema waited on a
 * variable is checked here, once the value is known.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";

import type { Markdown } from "../index.js";

import { holdsVariable, isVariable } from "../lib/attributes.js";
import { resolveOptions, validateTagAttributes } from "../lib/options.js";

/** How the visitor fills a document, and what it does with a name it has no value for. */
export interface VariablesOptions {
	/**
	 * The document's tag vocabulary, so a tag whose schema a variable deferred is checked
	 * once filled in. Passing the options the document was parsed with is the usual call.
	 */
	tags?: Markdown.Options["tags"];
	/** The document's HTML allowlist, so a URL an element's variable is filled with is checked. */
	html?: Markdown.Options["html"];
	/**
	 * `"fail"` turns a name with no value into a walk failure at the variable's position;
	 * `"keep"` leaves the variable in place for a later pass or a renderer to show.
	 * @default "fail"
	 */
	missing?: "fail" | "keep";
}

/**
 * Builds the visitor for one set of values. The values are read when the walk runs,
 * so one parsed document is filled per render, and nothing the visitor leaves alone
 * is copied: a block with no variable is handed back as the same object.
 *
 * @param values - The value each variable name stands for
 * @param options - The tags to check deferred schemas against, and the missing-name policy
 * @returns A visitor to pass to `Markdown.walk`, alone or spread beside others
 * @example Markdown.walk(document, variables({ plan: "Pro" }, MARKDOWN_OPTIONS))
 */
export function variables(
	values: Record<string, Markdown.AttributeValue>,
	options: VariablesOptions = {},
) {
	let keep = options.missing === "keep";
	let definitions = resolveOptions(options).tags;

	/** Fills one value, recursing into arrays and objects, and returns it unchanged when nothing in it is a variable. */
	function fill(value: Markdown.AttributeValue): Markdown.AttributeValue {
		if (value === null || typeof value !== "object") return value;
		if (isVariable(value)) return lookup(value) ?? value;
		if (!holdsVariable(value)) return value;
		if (Array.isArray(value)) return value.map(fill);

		let filled: { [key: string]: Markdown.AttributeValue } = {};
		for (let [key, item] of Object.entries(value)) {
			Object.defineProperty(filled, key, {
				value: fill(item),
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}
		return filled;
	}

	/**
	 * Walks the variable's dotted path one segment at a time, so a path that runs off
	 * its data at any segment counts as missing as a whole and names the full path.
	 *
	 * @returns The variable's value, or `undefined` when the caller asked to keep a missing one
	 * @throws {Error} When the path has no value and missing names fail
	 */
	function lookup(variable: Markdown.Variable): Markdown.AttributeValue | undefined {
		let value = resolve(values, variable.name.split("."));
		if (value !== undefined) return value;
		if (keep) return undefined;
		throw new Error(`No value for $${variable.name}`);
	}

	/** The block with its attributes filled, or `undefined` when they hold no variable. */
	function fillBlock<N extends Extract<Markdown.Block, { attributes: Markdown.Attributes }>>(
		node: N,
	): N | undefined {
		if (!holdsVariable(node.attributes)) return undefined;
		return { ...node, attributes: fill(node.attributes) as Markdown.Attributes };
	}

	/**
	 * A tag or element with its attributes filled and checked the way the parser
	 * deferred: a tag against its schema, an element against its allowlist's URL rules.
	 * An element the given allowlist does not name has its URLs checked all the same.
	 *
	 * @throws {MarkdownParseError} When the filled-in attributes fail that check
	 */
	function fillTag<N extends Markdown.Tag | Markdown.Element>(node: N): N | undefined {
		let filled = fillBlock(node);
		if (!filled) return undefined;

		let definition = definitions.get(node.name);
		if (node.type === "element" && !definition?.element) {
			let allowed = new Set(Object.keys(node.attributes));
			definition = { name: node.name, content: "inline", element: { level: "inline", allowed } };
		}
		if (!definition) return filled;

		let checked = validateTagAttributes(definition, filled.attributes, node.position);
		if (isFailure(checked)) throw checked.error;

		return { ...filled, attributes: checked.data };
	}

	/**
	 * A text hole becomes the text of its value.
	 *
	 * @throws {Error} When the value is a list, an object or null, which have no text form
	 */
	function fillText(node: Markdown.Variable): Markdown.Text | undefined {
		let value = lookup(node);
		if (value === undefined) return undefined;

		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			return { type: "text", value: String(value), position: node.position };
		}

		let kind = Array.isArray(value) ? "a list" : value === null ? "null" : "an object";
		throw new Error(
			`$${node.name} holds ${kind}, and only a string, number or boolean can stand in text`,
		);
	}

	return {
		heading: fillBlock,
		paragraph: fillBlock,
		code: fillBlock,
		list: fillBlock,
		listItem: fillBlock,
		blockquote: fillBlock,
		alert: fillBlock,
		table: fillBlock,
		tableRow: fillBlock,
		tableCell: fillBlock,
		thematicBreak: fillBlock,
		html: fillBlock,
		footnoteDefinition: fillBlock,
		tag: fillTag,
		element: fillTag,
		variable: fillText,
	} satisfies Markdown.Visitor;
}

/**
 * Reads only data the caller put there: own properties of an object and numeric
 * indexes of an array, so a path like `$plan.toString` or `$items.length` is missing.
 *
 * @param values - The values the path starts from
 * @param segments - The path's segments still to follow
 * @returns The value at the end of the path, or `undefined` when a segment is missing
 */
function resolve(
	values: Record<string, Markdown.AttributeValue>,
	segments: string[],
): Markdown.AttributeValue | undefined {
	let current: unknown = values;

	for (let segment of segments) {
		if (current === null || typeof current !== "object") return undefined;
		if (Array.isArray(current) !== /^\d+$/.test(segment)) return undefined;
		if (!Object.hasOwn(current, segment)) return undefined;
		current = (current as Record<string, unknown>)[segment];
	}

	return current as Markdown.AttributeValue | undefined;
}
