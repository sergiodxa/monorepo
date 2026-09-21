/**
 * Exclusive XML Canonicalization 1.0, over the located tree, without comments.
 * A digest is taken of bytes rather than of a tree, and this is the one place
 * that decides which bytes a subtree is, so the reader and the signature can
 * never disagree about what was covered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Element } from "./tree.js";

import { XML_NS } from "./namespaces.js";

/** The `PrefixList` token standing for the default namespace. */
const DEFAULT_PREFIX_TOKEN = "#default";

/**
 * How one canonicalization reads its subtree.
 */
export interface CanonicalizeOptions {
	/**
	 * Prefixes an `InclusiveNamespaces PrefixList` named, which are rendered as
	 * though the element used them, so a signer that pinned a prefix gets the
	 * same bytes back from a verifier that would otherwise have dropped it.
	 */
	inclusivePrefixes?: ReadonlySet<string>;

	/**
	 * One element left out along with everything beneath it, which is how the
	 * enveloped-signature transform removes the signature from what it covers.
	 */
	omit?: Element | null;
}

/**
 * Canonicalizes a subtree into the exact text its digest is taken over.
 *
 * @param target - Element whose subtree becomes the canonical form
 * @param options - Prefix list and the element the transform removes
 * @returns The canonical text, to be digested as UTF-8
 */
export function canonicalize(target: Element, options: CanonicalizeOptions = {}): string {
	let parts: string[] = [];
	let inclusive = options.inclusivePrefixes ?? new Set<string>();
	writeElement(target, new Map(), parts, inclusive, options.omit ?? null);
	return parts.join("");
}

/**
 * Writes one element, then its children under the namespace state it leaves
 * behind. The state is passed down rather than shared, so a declaration one
 * branch renders never suppresses the same declaration in a sibling.
 */
function writeElement(
	element: Element,
	rendered: ReadonlyMap<string, string>,
	parts: string[],
	inclusive: ReadonlySet<string>,
	omit: Element | null,
): void {
	if (element === omit) return;

	let declarations = declarationsFor(element, rendered, inclusive);

	parts.push(`<${element.name}`);

	for (let [prefix, uri] of declarations) {
		let name = prefix === "" ? "xmlns" : `xmlns:${prefix}`;
		parts.push(` ${name}="${escapeAttribute(uri)}"`);
	}

	for (let attribute of sortAttributes(element)) {
		parts.push(` ${attribute.name}="${escapeAttribute(attribute.value)}"`);
	}

	parts.push(">");

	let inherited = new Map(rendered);
	for (let [prefix, uri] of declarations) inherited.set(prefix, uri);

	for (let node of element.children) {
		if (node.kind === "text") parts.push(escapeText(node.text));
		else writeElement(node, inherited, parts, inclusive, omit);
	}

	parts.push(`</${element.name}>`);
}

/**
 * The namespace declarations this element writes out, in prefix order with the
 * default first. A binding an output ancestor already wrote is left off, which
 * is what keeps the form stable when a subtree is lifted out of its document.
 */
function declarationsFor(
	element: Element,
	rendered: ReadonlyMap<string, string>,
	inclusive: ReadonlySet<string>,
): [string, string][] {
	let declarations: [string, string][] = [];

	for (let prefix of [...utilizedPrefixes(element, inclusive)].sort()) {
		if (prefix === "xml") continue;

		let uri = element.scope.get(prefix) ?? "";
		let previous = rendered.get(prefix);

		if (uri === "") {
			if (prefix === "" && previous !== undefined && previous !== "") declarations.push(["", ""]);
			continue;
		}

		if (previous !== uri) declarations.push([prefix, uri]);
	}

	return declarations;
}

/**
 * The prefixes an element is written with: its own, those of its attributes,
 * and those the signer pinned through a prefix list. A prefix nothing here uses
 * is dropped, and dropping it is the difference this canonicalization makes.
 */
function utilizedPrefixes(element: Element, inclusive: ReadonlySet<string>): Set<string> {
	let prefixes = new Set<string>([element.prefix]);

	for (let attribute of element.attributes) {
		if (attribute.prefix !== "") prefixes.add(attribute.prefix);
	}

	for (let prefix of inclusive) {
		prefixes.add(prefix === DEFAULT_PREFIX_TOKEN ? "" : prefix);
	}

	return prefixes;
}

/**
 * The element's attributes in canonical order: by namespace first, then by
 * local name, with unprefixed attributes ahead of every namespaced one because
 * they belong to no namespace at all.
 */
function sortAttributes(element: Element) {
	return [...element.attributes].sort((left, right) => {
		let leftUri = left.prefix === "xml" ? XML_NS : left.uri;
		let rightUri = right.prefix === "xml" ? XML_NS : right.uri;
		if (leftUri !== rightUri) return leftUri < rightUri ? -1 : 1;
		if (left.local === right.local) return 0;
		return left.local < right.local ? -1 : 1;
	});
}

/**
 * Escapes one attribute value. Every character a re-parse would read back
 * differently — including the whitespace an attribute-value normalization would
 * otherwise flatten — is written as a reference instead.
 */
function escapeAttribute(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll('"', "&quot;")
		.replaceAll("\t", "&#x9;")
		.replaceAll("\n", "&#xA;")
		.replaceAll("\r", "&#xD;");
}

/**
 * Escapes one run of character data. A carriage return is written as a
 * reference because a parser would otherwise turn it into a line feed and
 * change the bytes a digest was taken over.
 */
function escapeText(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\r", "&#xD;");
}
