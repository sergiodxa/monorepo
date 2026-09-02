/**
 * Serializes plain XML document data into text, emitting the markup directly so
 * the package runs anywhere JavaScript does, workerd included. Namespace prefixes
 * are checked against the declarations in scope, names against `Name`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { XML } from "../index";

import { escapeAttribute, escapeText } from "./escape-xml";
import { isValidName } from "./xml-names";

/**
 * `xml` and `xmlns` are bound by the specification itself, so every document may
 * use them directly.
 */
const BUILT_IN_PREFIXES = ["xml", "xmlns"];

/**
 * Serializes plain XML document data into a string.
 *
 * @param input - The document data to serialize
 * @returns A Result containing the XML string or an error
 */
export function stringifyDocument(input: XML.Document): Result<string, Error> {
	if (!isValidName(input.root.name)) {
		return failure(new Error(`Invalid root element name "${input.root.name}".`));
	}

	let root = stringifyElement(input.root, new Set(BUILT_IN_PREFIXES));
	if (root.status === "failure") return root;

	let declaration = stringifyDeclaration(input.declaration);
	if (!declaration) return root;

	return success(`${declaration}\n${root.data}`);
}

/**
 * Writes one element and everything under it, threading the namespace prefixes
 * declared so far down the tree so a child can use a prefix an ancestor declared.
 */
function stringifyElement(
	element: XML.Element,
	inheritedPrefixes: Set<string>,
): Result<string, Error> {
	let attributes = element.attributes ?? {};
	let children = element.children ?? [];
	let prefixes = extendPrefixes(attributes, inheritedPrefixes);

	let elementPrefix = prefixOf(element.name);
	if (elementPrefix && !prefixes.has(elementPrefix)) {
		return failure(
			new Error(
				`Missing namespace declaration for prefix "${elementPrefix}" on element "${element.name}".`,
			),
		);
	}

	let serializedAttributes = stringifyAttributes(attributes, prefixes);
	if (serializedAttributes.status === "failure") return serializedAttributes;

	let open = `<${element.name}${serializedAttributes.data}`;
	if (children.length === 0) return success(`${open}/>`);

	let content = "";
	for (let child of children) {
		if (typeof child === "string") {
			content += escapeText(child);
			continue;
		}

		if (!isValidName(child.name)) {
			return failure(new Error(`Invalid element name "${child.name}".`));
		}

		let serializedChild = stringifyElement(child, prefixes);
		if (serializedChild.status === "failure") return serializedChild;

		content += serializedChild.data;
	}

	return success(`${open}>${content}</${element.name}>`);
}

/**
 * Writes the attribute list in declaration order, which keeps a serialized feed
 * byte-for-byte stable between runs.
 */
function stringifyAttributes(
	attributes: Record<string, string>,
	prefixes: Set<string>,
): Result<string, Error> {
	let serialized = "";

	for (let [name, value] of Object.entries(attributes)) {
		if (!isValidName(name)) return failure(new Error(`Invalid attribute name "${name}".`));

		let prefix = prefixOf(name);
		if (prefix && !prefixes.has(prefix)) {
			return failure(
				new Error(`Missing namespace declaration for prefix "${prefix}" on attribute "${name}".`),
			);
		}

		serialized += ` ${name}="${escapeAttribute(value)}"`;
	}

	return success(serialized);
}

/**
 * Collects the prefixes an element declares, so they cover the element itself
 * and everything nested inside it.
 */
function extendPrefixes(
	attributes: Record<string, string>,
	inheritedPrefixes: Set<string>,
): Set<string> {
	let prefixes = new Set(inheritedPrefixes);

	for (let name of Object.keys(attributes)) {
		if (name.startsWith("xmlns:")) prefixes.add(name.slice("xmlns:".length));
	}

	return prefixes;
}

/**
 * Reads the namespace prefix off a qualified name. An unprefixed name belongs to
 * the default namespace, which every element already has in scope.
 */
function prefixOf(name: string): string | undefined {
	let separator = name.indexOf(":");
	if (separator === -1) return undefined;
	return name.slice(0, separator);
}

/**
 * Converts the declaration object into a stable XML declaration string.
 */
function stringifyDeclaration(declaration?: XML.Declaration): string | undefined {
	if (!declaration) return undefined;

	let attributes = [`version="${declaration.version ?? "1.0"}"`];
	if (declaration.encoding) attributes.push(`encoding="${declaration.encoding}"`);
	if (declaration.standalone) attributes.push(`standalone="${declaration.standalone}"`);

	return `<?xml ${attributes.join(" ")}?>`;
}
