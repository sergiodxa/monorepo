/**
 * The parsed tree itself, published beside the query surface so another package
 * walks the document this one built: tree construction is the format, and a second
 * parser in a codebase is a second set of answers about the same markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	DOMAttribute,
	DOMDocument,
	DOMElement,
	DOMNode,
	DOMParent,
	DOMStyle,
} from "./lib/dom.js";

export { parseDocument } from "./lib/parse-document.js";
