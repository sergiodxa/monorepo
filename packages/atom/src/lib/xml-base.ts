/**
 * Tracks the `xml:base` and `xml:lang` in effect at a point in the tree, so a
 * relative reference resolves against the bases that enclose it. RFC 4287 §4.1.1
 * makes both inherited, and makes a relative base compose with the one above it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

/** The base URI and language inherited at one point in the document. */
export interface Scope {
	base?: string;
	lang?: string;
}

/**
 * Layers an element's own `xml:base` and `xml:lang` over the inherited scope. A
 * relative `xml:base` is resolved against the enclosing one, so nested bases
 * accumulate rather than replace.
 *
 * @param scope - The scope inherited from ancestors
 * @param element - The element whose attributes should be layered on top
 * @returns The scope in effect inside the element
 */
export function extendScope(scope: Scope, element: XML.Element): Scope {
	let attributes = element.attributes ?? {};
	let base = attributes["xml:base"];
	let lang = attributes["xml:lang"];

	if (base === undefined && lang === undefined) return scope;

	return {
		base: base === undefined ? scope.base : resolveUri(scope, base),
		lang: lang ?? scope.lang,
	};
}

/**
 * Resolves a reference against the base in scope.
 *
 * The reference is returned unchanged when no base applies or when the pair does
 * not form a URL, because a feed's own text is more useful to a consumer than a
 * value this package invented or dropped.
 *
 * @param scope - The scope supplying the base URI
 * @param reference - The possibly-relative reference to resolve
 * @returns The absolute reference, or the original when it cannot be resolved
 */
export function resolveUri(scope: Scope, reference: string): string {
	if (!scope.base) return reference;

	try {
		return new URL(reference, scope.base).toString();
	} catch {
		return reference;
	}
}
