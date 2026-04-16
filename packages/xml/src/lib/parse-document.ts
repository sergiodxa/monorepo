import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";
import { DOMParser as PolyfillDOMParser } from "@xmldom/xmldom";

import type { XML } from "../index";

let ELEMENT_NODE = 1;
let TEXT_NODE = 3;
let CDATA_SECTION_NODE = 4;
let XML_MIME_TYPE: DOMParserSupportedType = "application/xml";
let XML_DECLARATION_PATTERN = /^\s*<\?xml\s+([^?]+)\?>/i;
let XML_DECLARATION_ATTRIBUTE_PATTERN = /([a-zA-Z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g;

/**
 * Parses XML into plain document data using DOMParser-compatible APIs.
 *
 * @param source - Raw XML text to parse
 * @returns A Result containing XML document data or an error
 */
export function parseDocument(source: string): Result<XML.Document, Error> {
	let issues: string[] = [];
	let parser = createDOMParser(issues);
	let document = parser.parseFromString(source, XML_MIME_TYPE);
	let parserError = getParserError(document);

	if (parserError) {
		let message = parserError.textContent?.trim() || "Failed to parse XML.";
		return failure(new Error(message));
	}

	if (issues.length > 0) return failure(new Error(issues[0] ?? "Failed to parse XML."));

	let root = document.documentElement;
	if (!root) return failure(new Error("Expected a root element."));

	return success({
		declaration: parseDeclaration(source),
		root: parseElement(root),
	});
}

/**
 * Chooses workerd's DOMParser when available and falls back to xmldom in Bun.
 */
function createDOMParser(issues?: string[]): DOMParser {
	if (typeof DOMParser !== "undefined") return new DOMParser();
	return new PolyfillDOMParser({
		errorHandler: {
			warning(message) {
				issues?.push(message);
			},
			error(message) {
				issues?.push(message);
			},
			fatalError(message) {
				issues?.push(message);
			},
		},
	}) as unknown as DOMParser;
}

/**
 * Detects parser errors emitted by browser DOMParser implementations and xmldom.
 */
function getParserError(document: Document): Element | null {
	let root = document.documentElement;
	if (root?.tagName === "parsererror") return root;

	let parserError = document.getElementsByTagName("parsererror").item(0);
	if (parserError) return parserError;

	return null;
}

/**
 * Extracts the XML declaration because DOMParser does not preserve it in the tree.
 */
function parseDeclaration(source: string): XML.Declaration | undefined {
	let match = source.match(XML_DECLARATION_PATTERN);
	if (!match?.[1]) return undefined;

	let declaration: XML.Declaration = {};
	let attributes = match[1];
	let attributeMatch = XML_DECLARATION_ATTRIBUTE_PATTERN.exec(attributes);

	while (attributeMatch) {
		let name = attributeMatch[1];
		let value = attributeMatch[3];

		if (name === "version") declaration.version = value;
		if (name === "encoding") declaration.encoding = value;
		if (name === "standalone" && (value === "yes" || value === "no")) {
			declaration.standalone = value;
		}

		attributeMatch = XML_DECLARATION_ATTRIBUTE_PATTERN.exec(attributes);
	}

	XML_DECLARATION_ATTRIBUTE_PATTERN.lastIndex = 0;

	if (!declaration.version && !declaration.encoding && !declaration.standalone) {
		return undefined;
	}

	return declaration;
}

/**
 * Converts a DOM element into the package XML tree format.
 */
function parseElement(element: Element): XML.Element {
	let attributes: Record<string, string> = {};
	let children: XML.Node[] = [];

	for (let attribute of Array.from(element.attributes)) {
		attributes[attribute.name] = attribute.value;
	}

	for (let child of Array.from(element.childNodes)) {
		if (child.nodeType === ELEMENT_NODE) {
			children.push(parseElement(child as Element));
			continue;
		}

		if (child.nodeType !== TEXT_NODE && child.nodeType !== CDATA_SECTION_NODE) continue;

		let value = child.nodeValue ?? "";
		if (value.trim().length === 0) continue;
		children.push(value);
	}

	return { name: element.tagName, attributes, children };
}
