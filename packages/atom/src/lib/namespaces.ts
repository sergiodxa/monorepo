/**
 * Resolves which prefixes a document binds to which namespaces, so an element can
 * be tested for membership in the Atom namespace rather than for a spelling. The
 * XML layer performs no namespace resolution, so this package does its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import { ATOM_NAMESPACE } from "./constants.js";
import { prefixOf } from "./utils.js";

/** The namespace declarations in scope, keyed by prefix with `""` for the default. */
export type NamespaceScope = Record<string, string>;

/**
 * Reads every `xmlns` declaration off an element.
 *
 * @param element - The element whose declarations should be read
 * @returns The declared namespaces, keyed by prefix
 */
export function readNamespaceDeclarations(element: XML.Element): NamespaceScope {
	let declarations: NamespaceScope = {};

	for (let [name, value] of Object.entries(element.attributes ?? {})) {
		if (name === "xmlns") {
			declarations[""] = value;
			continue;
		}
		if (name.startsWith("xmlns:")) declarations[name.slice("xmlns:".length)] = value;
	}

	return declarations;
}

/**
 * Extends an inherited scope with the declarations an element adds, so a nested
 * element that rebinds a prefix is read against its own binding.
 *
 * @param scope - The namespaces inherited from ancestors
 * @param element - The element whose declarations should be layered on top
 * @returns The scope in effect inside the element
 */
export function extendNamespaceScope(scope: NamespaceScope, element: XML.Element): NamespaceScope {
	let declarations = readNamespaceDeclarations(element);
	if (Object.keys(declarations).length === 0) return scope;
	return { ...scope, ...declarations };
}

/**
 * Resolves the namespace a qualified name belongs to under a scope.
 *
 * @param name - The qualified element name
 * @param scope - The namespaces in effect
 * @returns The namespace URI, or `undefined` when the prefix is unbound
 */
export function namespaceOf(name: string, scope: NamespaceScope): string | undefined {
	return scope[prefixOf(name)];
}

/**
 * Reports whether an element belongs to the Atom namespace, which is what
 * separates an Atom element from a foreign one carrying the same local name.
 *
 * @param name - The qualified element name
 * @param scope - The namespaces in effect
 * @returns `true` when the name resolves to the Atom namespace
 */
export function isAtomName(name: string, scope: NamespaceScope): boolean {
	return namespaceOf(name, scope) === ATOM_NAMESPACE;
}
