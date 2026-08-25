/**
 * Serializes plain XML document data into a string, resolving namespace
 * prefixes and rejecting elements or attributes with no matching declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";
import {
	DOMParser as PolyfillDOMParser,
	XMLSerializer as PolyfillXMLSerializer,
} from "@xmldom/xmldom";

import type { XML } from "../index";

let XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
let XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
let XML_MIME_TYPE: DOMParserSupportedType = "application/xml";

/**
 * Serializes plain XML document data into a string.
 *
 * @param input - The document data to serialize
 * @returns A Result containing the XML string or an error
 */
export function stringifyDocument(input: XML.Document): Result<string, Error> {
	let documentResult = createXMLDocument(input.root.name);
	if (documentResult.status === "failure") return documentResult;

	let document = documentResult.data;
	let rootResult = buildElement(document, input.root, createNamespaceScope());
	if (rootResult.status === "failure") return rootResult;

	let currentRoot = document.documentElement;
	let nextRoot = rootResult.data;

	if (!currentRoot) return failure(new Error("Expected a root element to serialize."));

	document.replaceChild(nextRoot, currentRoot);

	let serializer = createXMLSerializer();
	let xml = serializer.serializeToString(document);
	let serializedDeclaration = serializeDeclaration(input.declaration);

	if (!serializedDeclaration) return success(xml);
	return success(`${serializedDeclaration}\n${xml}`);
}

/**
 * Chooses workerd's XMLSerializer when available and falls back to xmldom in Bun.
 */
function createXMLSerializer(): XMLSerializer {
	if (typeof XMLSerializer !== "undefined") return new XMLSerializer();
	return new PolyfillXMLSerializer() as unknown as XMLSerializer;
}

/**
 * Creates a fresh XML document so XMLSerializer can emit a valid root element.
 */
function createXMLDocument(rootName: string): Result<Document, Error> {
	let parser = createDOMParser();
	let seed = parser.parseFromString(`<${rootName}/>`, XML_MIME_TYPE);
	let parserError = getParserError(seed);

	if (parserError) return failure(new Error(`Invalid root element name "${rootName}".`));

	let implementation = seed.implementation;
	if (!implementation) return failure(new Error("Expected DOMImplementation to create XML."));

	let document = implementation.createDocument(null, rootName);
	return success(document);
}

/**
 * Chooses workerd's DOMParser when available and falls back to xmldom in Bun.
 */
function createDOMParser(): DOMParser {
	if (typeof DOMParser !== "undefined") return new DOMParser();
	return new PolyfillDOMParser() as unknown as DOMParser;
}

/**
 * Detects parser errors emitted while validating a synthetic root element.
 */
function getParserError(document: Document): Element | null {
	let root = document.documentElement;
	if (root?.tagName === "parsererror") return root;

	let parserError = document.getElementsByTagName("parsererror").item(0);
	if (parserError) return parserError;

	return null;
}

/**
 * Builds one DOM element while keeping XML namespace declarations in scope.
 */
function buildElement(
	document: Document,
	element: XML.Element,
	inheritedNamespaces: Map<string, string>,
): Result<Element, Error> {
	let attributes = element.attributes ?? {};
	let children = element.children ?? [];
	let namespaces = extendNamespaces(attributes, inheritedNamespaces);
	let namespaceURI = resolveElementNamespace(element.name, namespaces);
	let domElement: Element;

	if (namespaceURI) {
		domElement = document.createElementNS(namespaceURI, element.name);
	} else if (element.name.includes(":")) {
		let prefix = element.name.split(":")[0] ?? element.name;
		return failure(
			new Error(
				`Missing namespace declaration for prefix "${prefix}" on element "${element.name}".`,
			),
		);
	} else {
		domElement = document.createElement(element.name);
	}

	for (let [name, value] of Object.entries(attributes)) {
		if (name === "xmlns") {
			domElement.setAttributeNS(XMLNS_NAMESPACE, "xmlns", value);
			continue;
		}

		if (name.startsWith("xmlns:")) {
			domElement.setAttributeNS(XMLNS_NAMESPACE, name, value);
			continue;
		}

		if (name.includes(":")) {
			let attributeNamespace = resolveAttributeNamespace(name, namespaces);
			if (!attributeNamespace) {
				let prefix = name.split(":")[0] ?? name;
				return failure(
					new Error(`Missing namespace declaration for prefix "${prefix}" on attribute "${name}".`),
				);
			}

			domElement.setAttributeNS(attributeNamespace, name, value);
			continue;
		}

		domElement.setAttribute(name, value);
	}

	for (let child of children) {
		if (typeof child === "string") {
			domElement.appendChild(document.createTextNode(child));
			continue;
		}

		let childResult = buildElement(document, child, namespaces);
		if (childResult.status === "failure") return childResult;

		domElement.appendChild(childResult.data);
	}

	return success(domElement);
}

/**
 * Seeds serialization with the standard XML namespace prefixes.
 */
function createNamespaceScope(): Map<string, string> {
	return new Map([
		["xml", XML_NAMESPACE],
		["xmlns", XMLNS_NAMESPACE],
	]);
}

/**
 * Tracks namespace declarations as elements introduce new `xmlns` attributes.
 */
function extendNamespaces(
	attributes: Record<string, string>,
	inheritedNamespaces: Map<string, string>,
): Map<string, string> {
	let namespaces = new Map(inheritedNamespaces);

	for (let [name, value] of Object.entries(attributes)) {
		if (name === "xmlns") namespaces.set("", value);
		if (name.startsWith("xmlns:")) namespaces.set(name.slice(6), value);
	}

	return namespaces;
}

/**
 * Resolves the namespace URI for an element name from the current namespace scope.
 */
function resolveElementNamespace(name: string, namespaces: Map<string, string>): string | null {
	let separator = name.indexOf(":");
	if (separator === -1) return namespaces.get("") ?? null;

	let prefix = name.slice(0, separator);
	return namespaces.get(prefix) ?? null;
}

/**
 * Resolves the namespace URI for a prefixed attribute name.
 */
function resolveAttributeNamespace(name: string, namespaces: Map<string, string>): string | null {
	let separator = name.indexOf(":");
	if (separator === -1) return null;

	let prefix = name.slice(0, separator);
	return namespaces.get(prefix) ?? null;
}

/**
 * Converts the declaration object into a stable XML declaration string.
 */
function serializeDeclaration(declaration?: XML.Declaration): string | undefined {
	if (!declaration) return undefined;

	let attributes = [`version="${declaration.version ?? "1.0"}"`];
	if (declaration.encoding) attributes.push(`encoding="${declaration.encoding}"`);
	if (declaration.standalone) attributes.push(`standalone="${declaration.standalone}"`);

	return `<?xml ${attributes.join(" ")}?>`;
}
