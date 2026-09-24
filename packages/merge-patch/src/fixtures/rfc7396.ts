/**
 * The worked examples of RFC 7396, vendored verbatim: Section 3's document edit and every
 * row of Appendix A. Source: https://www.rfc-editor.org/rfc/rfc7396 (October 2014). Code
 * Components of IETF documents are licensed under the Simplified BSD License (IETF Trust).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JSONValue } from "../json-value.js";

/** One example: applying `patch` to `original` produces `result`. */
export interface MergePatchExample {
	original: JSONValue;
	patch: JSONValue;
	result: JSONValue;
}

/** Section 3: the document a client edits with one patch changing, removing and adding members. */
export const SECTION_3_EXAMPLE: MergePatchExample = {
	original: {
		title: "Goodbye!",
		author: { givenName: "John", familyName: "Doe" },
		tags: ["example", "sample"],
		content: "This will be unchanged",
	},
	patch: {
		title: "Hello!",
		phoneNumber: "+01-123-456-7890",
		author: { familyName: null },
		tags: ["example"],
	},
	result: {
		title: "Hello!",
		author: { givenName: "John" },
		tags: ["example"],
		content: "This will be unchanged",
		phoneNumber: "+01-123-456-7890",
	},
};

/** Appendix A, in the order the RFC lists them. */
export const APPENDIX_A_EXAMPLES: MergePatchExample[] = [
	{ original: { a: "b" }, patch: { a: "c" }, result: { a: "c" } },
	{ original: { a: "b" }, patch: { b: "c" }, result: { a: "b", b: "c" } },
	{ original: { a: "b" }, patch: { a: null }, result: {} },
	{ original: { a: "b", b: "c" }, patch: { a: null }, result: { b: "c" } },
	{ original: { a: ["b"] }, patch: { a: "c" }, result: { a: "c" } },
	{ original: { a: "c" }, patch: { a: ["b"] }, result: { a: ["b"] } },
	{ original: { a: { b: "c" } }, patch: { a: { b: "d", c: null } }, result: { a: { b: "d" } } },
	{ original: { a: [{ b: "c" }] }, patch: { a: [1] }, result: { a: [1] } },
	{ original: ["a", "b"], patch: ["c", "d"], result: ["c", "d"] },
	{ original: { a: "b" }, patch: ["c"], result: ["c"] },
	{ original: { a: "foo" }, patch: null, result: null },
	{ original: { a: "foo" }, patch: "bar", result: "bar" },
	{ original: { e: null }, patch: { a: 1 }, result: { e: null, a: 1 } },
	{ original: [1, 2], patch: { a: "b", c: null }, result: { a: "b" } },
	{ original: {}, patch: { a: { bb: { ccc: null } } }, result: { a: { bb: {} } } },
];
