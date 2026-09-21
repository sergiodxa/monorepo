/**
 * A parsed document re-walked once into nodes that know their parent, their
 * namespace scope and their resolved name, so canonicalization, reference
 * resolution and every read below work from one shape instead of each
 * re-deriving what a prefix meant at the point it was written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import { XML_NS, XMLNS_NS } from "./namespaces.js";

/**
 * One attribute with its prefix resolved. An attribute written without a prefix
 * belongs to no namespace at all, which is what lets `ID` and `xml:id` sort and
 * compare as the different attributes they are.
 */
export interface Attribute {
	name: string;
	prefix: string;
	local: string;
	uri: string;
	value: string;
}

/**
 * A text node, kept apart from an element so canonicalization can write the
 * children of an element back in the order the source had them.
 */
export interface Text {
	kind: "text";
	text: string;
}

/**
 * One element, with the namespace bindings in force at it and the parent it
 * hangs from. `scope` holds every prefix visible here, declarations inherited
 * from ancestors included; `declarations` holds only the ones written on it.
 */
export interface Element {
	kind: "element";
	name: string;
	prefix: string;
	local: string;
	uri: string;
	attributes: Attribute[];
	declarations: Map<string, string>;
	scope: ReadonlyMap<string, string>;
	children: Node[];
	parent: Element | null;
}

/** Either kind of child a canonicalized element can carry. */
export type Node = Element | Text;

/**
 * Splits a qualified name into its prefix and local part. A name with no colon
 * is all local part, and a name whose colon leads or trails is treated the same
 * way, so a malformed name resolves to no namespace rather than to a wrong one.
 */
function splitName(name: string): { prefix: string; local: string } {
	let colon = name.indexOf(":");
	if (colon <= 0 || colon === name.length - 1) return { prefix: "", local: name };
	return { prefix: name.slice(0, colon), local: name.slice(colon + 1) };
}

/**
 * Resolves a prefix against the bindings in force. `xml` is bound without ever
 * being declared, and an unprefixed attribute belongs to no namespace, which is
 * why only elements fall back to the default declaration.
 */
function resolve(prefix: string, scope: ReadonlyMap<string, string>, isElement: boolean): string {
	if (prefix === "xml") return XML_NS;
	if (prefix === "xmlns") return XMLNS_NS;
	if (prefix === "") return isElement ? (scope.get("") ?? "") : "";
	return scope.get(prefix) ?? "";
}

/**
 * Walks a parsed tree once, producing the located tree every other read works
 * from. Building it up front is what makes a prefix mean the same thing to the
 * digest and to the reader, since both consult the scope recorded here.
 *
 * @param root - Root element of a parsed document
 * @returns The located root, with every descendant already located
 */
export function locate(root: XML.Element): Element {
	return locateElement(root, null, new Map());
}

/**
 * Locates one element under the bindings its ancestors left in force, then
 * recurses with the bindings it adds of its own.
 */
function locateElement(
	source: XML.Element,
	parent: Element | null,
	inherited: ReadonlyMap<string, string>,
): Element {
	let declarations = new Map<string, string>();
	let scope = new Map(inherited);
	let written: Record<string, string> = source.attributes ?? {};

	for (let [name, value] of Object.entries(written)) {
		if (name === "xmlns") declarations.set("", value);
		else if (name.startsWith("xmlns:")) declarations.set(name.slice("xmlns:".length), value);
		else continue;
	}

	for (let [prefix, uri] of declarations) {
		if (uri === "") scope.delete(prefix);
		else scope.set(prefix, uri);
	}

	let attributes: Attribute[] = [];
	for (let [name, value] of Object.entries(written)) {
		if (name === "xmlns" || name.startsWith("xmlns:")) continue;
		let { prefix, local } = splitName(name);
		attributes.push({ name, prefix, local, uri: resolve(prefix, scope, false), value });
	}

	let { prefix, local } = splitName(source.name);
	let element: Element = {
		kind: "element",
		name: source.name,
		prefix,
		local,
		uri: resolve(prefix, scope, true),
		attributes,
		declarations,
		scope,
		children: [],
		parent,
	};

	for (let child of source.children ?? []) {
		if (typeof child === "string") element.children.push({ kind: "text", text: child });
		else element.children.push(locateElement(child, element, scope));
	}

	return element;
}

/**
 * Yields an element and every element beneath it, in document order.
 *
 * @param element - Element to start from
 * @yields The element itself, then each descendant
 */
export function* walk(element: Element): Generator<Element> {
	yield element;
	for (let child of element.children) {
		if (child.kind === "element") yield* walk(child);
	}
}

/**
 * The element children carrying one qualified name, in document order.
 *
 * @param element - Element whose children to read
 * @param uri - Namespace the children must belong to
 * @param local - Local name the children must carry
 */
export function children(element: Element, uri: string, local: string): Element[] {
	let matches: Element[] = [];
	for (let child of element.children) {
		if (child.kind === "element" && child.uri === uri && child.local === local) matches.push(child);
	}
	return matches;
}

/**
 * The first element child carrying one qualified name.
 *
 * @param element - Element whose children to read
 * @param uri - Namespace the child must belong to
 * @param local - Local name the child must carry
 */
export function child(element: Element, uri: string, local: string): Element | undefined {
	return children(element, uri, local).at(0);
}

/**
 * The value of an attribute written without a prefix, which is where SAML puts
 * every attribute a reader needs.
 *
 * @param element - Element whose attributes to read
 * @param name - Attribute name, as written
 */
export function attribute(element: Element, name: string): string | undefined {
	return element.attributes.find((candidate) => candidate.uri === "" && candidate.name === name)
		?.value;
}

/**
 * The character data directly inside an element, concatenated in order.
 *
 * @param element - Element whose text to read
 */
export function text(element: Element): string {
	let parts: string[] = [];
	for (let node of element.children) {
		if (node.kind === "text") parts.push(node.text);
	}
	return parts.join("");
}

/**
 * Every element in a document carrying one `ID` value, under any of the three
 * spellings XML signatures use for it. A reference resolves only where this
 * answers exactly one element, so a second element carrying the value is
 * ambiguity the caller refuses rather than a first match it picks.
 *
 * @param root - Root of the document to search
 * @param id - Value the attribute must hold
 */
export function elementsWithId(root: Element, id: string): Element[] {
	let matches: Element[] = [];
	for (let element of walk(root)) {
		let carries = element.attributes.some((candidate) => {
			if (candidate.uri !== "" && candidate.uri !== XML_NS) return false;
			if (candidate.local !== "ID" && candidate.local !== "Id" && candidate.local !== "id") {
				return false;
			}
			return candidate.value === id;
		});
		if (carries) matches.push(element);
	}
	return matches;
}

/**
 * Whether one element sits anywhere beneath another, which is what tells an
 * assertion the signature covered from one parked beside the element it signed.
 *
 * @param ancestor - Element the descendant must hang from
 * @param element - Element to test
 */
export function descendsFrom(ancestor: Element, element: Element): boolean {
	for (let cursor = element.parent; cursor; cursor = cursor.parent) {
		if (cursor === ancestor) return true;
	}
	return false;
}
