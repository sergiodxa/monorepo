/**
 * The DOM vocabulary the package reads a parsed document through, declared here so
 * that it describes the objects the parser produces and nothing else: a consumer
 * compiling this source brings its own globals, and these types stay the same under
 * every one of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One attribute, spelled the way the markup spells it. */
export interface DOMAttribute {
	name: string;
	value: string;
}

/** What a text read walks: an element, a text node, or anything else a tree holds. */
export interface DOMNode {
	nodeType: number;
	nodeValue: string | null;
	textContent: string | null;
	childNodes: ArrayLike<DOMNode>;
}

/** What a lookup runs against — the document, or a match read as its own scope. */
export interface DOMParent extends DOMNode {
	querySelector(selectors: string): DOMElement | null;
	querySelectorAll(selectors: string): ArrayLike<DOMElement>;
}

/** An element: what it is called, what it carries, and the neighbours a role reads. */
export interface DOMElement extends DOMParent {
	localName: string;
	attributes: ArrayLike<DOMAttribute>;
	children: ArrayLike<DOMElement>;
	parentElement: DOMElement | null;
	nextElementSibling: DOMElement | null;
	getAttribute(name: string): string | null;
	hasAttribute(name: string): boolean;
	closest(selectors: string): DOMElement | null;
}

/** A parsed page, whose `body` holds everything a reader sees. */
export interface DOMDocument extends DOMParent {
	body: DOMElement;
}

/** A style declaration, read one property at a time, which is all a visibility rule asks. */
export interface DOMStyle {
	getPropertyValue(property: string): string;
}
