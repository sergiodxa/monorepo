/**
 * Parses XML text into plain document data by scanning the source directly, so
 * the package runs anywhere JavaScript does, workerd included. Covers the subset
 * RSS and similar feeds use: one root, attributes, text, CDATA, prefixed names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { XML } from "../index";

import { decodeEntities } from "./decode-entities";
import { matchName } from "./xml-names";

const XML_DECLARATION_PATTERN = /^\s*<\?xml\s+([^?]+)\?>/i;
const XML_DECLARATION_ATTRIBUTE_PATTERN = /([a-zA-Z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g;

/**
 * Literal tabs and line breaks inside an attribute value are collapsed to spaces
 * before references are resolved, so `&#10;` still survives as a line break.
 */
const ATTRIBUTE_WHITESPACE_PATTERN = /[\t\n\r]/g;

const WHITESPACE_PATTERN = /\s/;

/**
 * Pairs a scanned value with the offset the scan stopped at, so each reader can
 * hand the main loop both what it read and where to continue.
 */
interface Scan<T> {
	value: T;
	next: number;
}

/**
 * One start tag, before it is known whether children follow.
 */
interface OpeningTag {
	name: string;
	attributes: Record<string, string>;
	selfClosing: boolean;
}

/**
 * Parses XML into plain document data.
 *
 * @param source - Raw XML text to parse
 * @returns A Result containing XML document data or an error
 */
export function parseDocument(source: string): Result<XML.Document, Error> {
	let root = parseRoot(source);
	if (root.status === "failure") return root;

	return success({ declaration: parseDeclaration(source), root: root.data });
}

/**
 * Walks the source once, building the element tree on a stack of open elements.
 * Text and CDATA that hold only whitespace are dropped, which keeps indentation
 * out of the tree and leaves feed traversal working on elements alone.
 */
function parseRoot(source: string): Result<XML.Element, Error> {
	let stack: XML.Element[] = [];
	let root: XML.Element | undefined;
	let index = 0;

	while (index < source.length) {
		if (source[index] !== "<") {
			let text = readText(source, index);
			if (text.status === "failure") return text;

			let parent = stack.at(-1);
			if (parent) parent.children?.push(...text.data.value);
			else if (text.data.value[0]) return failure(strayContent(root, text.data.value[0]));

			index = text.data.next;
			continue;
		}

		if (source.startsWith("<!--", index)) {
			let skipped = skipUntil(source, index, "-->", "comment");
			if (skipped.status === "failure") return skipped;
			index = skipped.data;
			continue;
		}

		if (source.startsWith("<![CDATA[", index)) {
			let section = readCDATA(source, index);
			if (section.status === "failure") return section;

			stack.at(-1)?.children?.push(...section.data.value);
			index = section.data.next;
			continue;
		}

		if (source.startsWith("<?", index)) {
			let skipped = skipUntil(source, index, "?>", "processing instruction");
			if (skipped.status === "failure") return skipped;
			index = skipped.data;
			continue;
		}

		if (source.startsWith("<!", index)) {
			let skipped = skipDoctype(source, index);
			if (skipped.status === "failure") return skipped;
			index = skipped.data;
			continue;
		}

		if (source.startsWith("</", index)) {
			let closing = readClosingTag(source, index);
			if (closing.status === "failure") return closing;

			let open = stack.at(-1);
			if (!open) return failure(new Error(`Unexpected closing tag "${closing.data.value}".`));
			if (open.name !== closing.data.value) {
				return failure(
					new Error(`Opening and ending tag mismatch: "${open.name}" != "${closing.data.value}"`),
				);
			}

			stack.pop();
			index = closing.data.next;
			continue;
		}

		let opening = readOpeningTag(source, index);
		if (opening.status === "failure") return opening;

		let element: XML.Element = {
			name: opening.data.value.name,
			attributes: opening.data.value.attributes,
			children: [],
		};

		let parent = stack.at(-1);
		if (parent) parent.children?.push(element);
		else if (root) return failure(new Error("Extra content at the end of the document"));
		else root = element;

		if (!opening.data.value.selfClosing) stack.push(element);
		index = opening.data.next;
	}

	if (stack.length > 0) {
		return failure(new Error(`unclosed xml tag(s): ${stack.map((open) => open.name).join(", ")}`));
	}

	if (!root) return failure(new Error("missing root element"));
	return success(root);
}

/**
 * Reads the character data up to the next `<`, resolving references first so a
 * run that decodes to nothing but whitespace is dropped along with plain indentation.
 */
function readText(source: string, index: number): Result<Scan<string[]>, Error> {
	let end = source.indexOf("<", index);
	let stop = end === -1 ? source.length : end;

	let decoded = decodeEntities(source.slice(index, stop));
	if (decoded.status === "failure") return decoded;

	let kept = decoded.data.trim().length > 0 ? [decoded.data] : [];
	return success({ value: kept, next: stop });
}

/**
 * Reads a CDATA section, whose content reaches the tree verbatim because CDATA
 * exists precisely to carry markup as literal text.
 */
function readCDATA(source: string, index: number): Result<Scan<string[]>, Error> {
	let start = index + "<![CDATA[".length;
	let end = source.indexOf("]]>", start);
	if (end === -1) return failure(new Error("Unterminated CDATA section"));

	let content = source.slice(start, end);
	let kept = content.trim().length > 0 ? [content] : [];

	return success({ value: kept, next: end + "]]>".length });
}

/**
 * Skips past a construct the tree leaves out, such as a comment or a processing
 * instruction, and names it when the source leaves it unterminated.
 */
function skipUntil(
	source: string,
	index: number,
	terminator: string,
	label: string,
): Result<number, Error> {
	let end = source.indexOf(terminator, index);
	if (end === -1) return failure(new Error(`Unterminated ${label}`));
	return success(end + terminator.length);
}

/**
 * Skips a doctype declaration, tracking the internal subset so the declaration
 * ends at the `>` that closes it.
 */
function skipDoctype(source: string, index: number): Result<number, Error> {
	let depth = 0;

	for (let cursor = index; cursor < source.length; cursor++) {
		let character = source[cursor];
		if (character === "[") depth++;
		if (character === "]") depth--;
		if (character === ">" && depth <= 0) return success(cursor + 1);
	}

	return failure(new Error("Unterminated doctype declaration"));
}

/**
 * Reads a closing tag and reports the name it closes.
 */
function readClosingTag(source: string, index: number): Result<Scan<string>, Error> {
	let name = matchName(source, index + "</".length);
	if (!name) return failure(new Error("Expected an element name after `</`."));

	let cursor = skipWhitespace(source, index + "</".length + name.length);
	if (source[cursor] !== ">") return failure(new Error(`Unterminated closing tag "${name}".`));

	return success({ value: name, next: cursor + 1 });
}

/**
 * Reads a start tag with its attributes, reporting whether it closes itself.
 */
function readOpeningTag(source: string, index: number): Result<Scan<OpeningTag>, Error> {
	let name = matchName(source, index + 1);
	if (!name) return failure(new Error("Expected an element name after `<`."));

	let attributes: Record<string, string> = {};
	let cursor = index + 1 + name.length;

	while (cursor < source.length) {
		let afterWhitespace = skipWhitespace(source, cursor);

		if (source.startsWith("/>", afterWhitespace)) {
			return success({
				value: { name, attributes, selfClosing: true },
				next: afterWhitespace + 2,
			});
		}

		if (source[afterWhitespace] === ">") {
			return success({
				value: { name, attributes, selfClosing: false },
				next: afterWhitespace + 1,
			});
		}

		if (afterWhitespace === cursor) {
			return failure(new Error(`Expected whitespace between attributes of "${name}".`));
		}

		let attribute = readAttribute(source, afterWhitespace, name);
		if (attribute.status === "failure") return attribute;

		if (attribute.data.value.name in attributes) {
			return failure(new Error(`Attribute ${attribute.data.value.name} redefined`));
		}

		attributes[attribute.data.value.name] = attribute.data.value.value;
		cursor = attribute.data.next;
	}

	return failure(new Error(`Unterminated opening tag "${name}".`));
}

/**
 * Reads one `name="value"` pair. The value keeps its quote style out of the tree
 * and arrives with whitespace normalized and references resolved.
 */
function readAttribute(
	source: string,
	index: number,
	elementName: string,
): Result<Scan<{ name: string; value: string }>, Error> {
	let name = matchName(source, index);
	if (!name) return failure(new Error(`Expected an attribute name in "${elementName}".`));

	let cursor = skipWhitespace(source, index + name.length);
	if (source[cursor] !== "=") return failure(new Error(`attribute "${name}" missed value!`));

	cursor = skipWhitespace(source, cursor + 1);
	let quote = source[cursor];
	if (quote !== '"' && quote !== "'") {
		return failure(new Error(`attribute "${name}" missed quot(")!`));
	}

	let end = source.indexOf(quote, cursor + 1);
	if (end === -1) return failure(new Error(`attribute "${name}" missed quot(")!`));

	let raw = source.slice(cursor + 1, end).replace(ATTRIBUTE_WHITESPACE_PATTERN, " ");
	let decoded = decodeEntities(raw);
	if (decoded.status === "failure") return decoded;

	return success({ value: { name, value: decoded.data }, next: end + 1 });
}

/**
 * Advances past any run of whitespace and reports where it ended.
 */
function skipWhitespace(source: string, index: number): number {
	let cursor = index;
	while (cursor < source.length && WHITESPACE_PATTERN.test(source[cursor] ?? "")) cursor++;
	return cursor;
}

/**
 * Names the failure for text found outside the root, which reads differently
 * depending on whether the root has already been opened.
 */
function strayContent(root: XML.Element | undefined, text: string): Error {
	if (root) return new Error("Extra content at the end of the document");
	return new Error(`Unexpected content outside root element: '${text}'`);
}

/**
 * Extracts the XML declaration, which sits ahead of the tree and so is read
 * straight from the source.
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
