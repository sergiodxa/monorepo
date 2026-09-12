/**
 * Exercises the traversal behind `Markdown.walk`: what a handler's return does
 * to a node, which subtrees survive by reference, and that a visitor with no
 * asynchronous handler answers without a promise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import { Markdown, MarkdownWalkError } from "../index.js";

/** A visitor whose handlers all answer synchronously, which is what `Walked` reads as a `Result`. */
const SYNC_VISITOR = {
	text(node: Markdown.Text) {
		return { ...node, value: node.value.toUpperCase() };
	},
} satisfies Markdown.Visitor;

/** A visitor with one asynchronous handler, which is what turns the whole walk into a promise. */
const ASYNC_VISITOR = {
	async text(node: Markdown.Text) {
		return { ...node, value: node.value.toUpperCase() };
	},
} satisfies Markdown.Visitor;

/** Positions carry the line so a failure can be asserted against the node it was standing on. */
function position(line = 1): Markdown.Position {
	return {
		start: { line, column: 1, offset: line },
		end: { line, column: 2, offset: line + 1 },
	};
}

/** @param value - The literal text the node holds */
function text(value: string, line = 1): Markdown.Text {
	return { type: "text", value, position: position(line) };
}

/** @param children - Inline nodes the paragraph wraps */
function paragraph(children: Markdown.Inline[], line = 1): Markdown.Paragraph {
	return { type: "paragraph", attributes: {}, children, position: position(line) };
}

/** @param children - Inline nodes the heading wraps */
function heading(children: Markdown.Inline[], line = 1): Markdown.Heading {
	return { type: "heading", level: 2, attributes: {}, children, position: position(line) };
}

/** @param content - The source the fence holds */
function code(content: string, line = 1): Markdown.Code {
	return { type: "code", language: "ts", content, attributes: {}, position: position(line) };
}

/** @param children - Blocks the quote wraps */
function blockquote(children: Markdown.Block[], line = 1): Markdown.Blockquote {
	return { type: "blockquote", attributes: {}, children, position: position(line) };
}

/** @param children - The blocks the document is made of */
function document(children: Markdown.Block[]): Markdown.Document {
	return { type: "document", children, position: position(1) };
}

/** Reads the data out of a walk that is expected to succeed, failing the test otherwise. */
function walked(result: Result<Markdown.Document, Markdown.WalkError>): Markdown.Document {
	if (!isSuccess(result)) throw result.error;
	return result.data;
}

describe("walkNode", () => {
	test("replaces a node with the one its handler returns", () => {
		let doc = document([paragraph([text("hello")])]);

		let result = walked(
			Markdown.walk(doc, {
				text(node) {
					return { ...node, value: `${node.value}!` };
				},
			}),
		);

		let block = result.children[0] as Markdown.Paragraph;
		expect(block.children).toEqual([{ ...text("hello"), value: "hello!" }]);
	});

	test("splices an array of nodes in place of one", () => {
		let doc = document([paragraph([text("a"), text("b")])]);

		let result = walked(
			Markdown.walk(doc, {
				text(node) {
					if (node.value !== "a") return;
					return [text("one"), text("two")];
				},
			}),
		);

		let block = result.children[0] as Markdown.Paragraph;
		expect(block.children.map((child) => (child as Markdown.Text).value)).toEqual([
			"one",
			"two",
			"b",
		]);
	});

	test("removes a node whose handler returns null", () => {
		let doc = document([heading([text("title")]), code("let a = 1"), paragraph([text("body")])]);

		let result = walked(Markdown.walk(doc, { code: () => null }));

		expect(result.children.map((child) => child.type)).toEqual(["heading", "paragraph"]);
	});

	test("passes a node with no handler through and still visits its children", () => {
		let doc = document([blockquote([paragraph([text("deep")])])]);

		let result = walked(
			Markdown.walk(doc, {
				text(node) {
					return { ...node, value: node.value.toUpperCase() };
				},
			}),
		);

		let quote = result.children[0] as Markdown.Blockquote;
		let inner = quote.children[0] as Markdown.Paragraph;
		expect((inner.children[0] as Markdown.Text).value).toBe("DEEP");
	});

	test("visits the children of a replacement without visiting the replacement itself", () => {
		let doc = document([paragraph([text("original")])]);
		let seen: string[] = [];

		let result = walked(
			Markdown.walk(doc, {
				paragraph(node) {
					seen.push("paragraph");
					return { ...node, children: [text("replaced")] };
				},
				text(node) {
					seen.push(node.value);
					return { ...node, value: node.value.toUpperCase() };
				},
			}),
		);

		let block = result.children[0] as Markdown.Paragraph;
		expect((block.children[0] as Markdown.Text).value).toBe("REPLACED");
		expect(seen).toEqual(["paragraph", "replaced"]);
	});

	test("runs a handler once when it returns a node of the same type", () => {
		let doc = document([code("let a = 1")]);
		let calls = 0;

		let result = walked(
			Markdown.walk(doc, {
				code(node) {
					calls += 1;
					return { ...node, content: `${node.content};` };
				},
			}),
		);

		expect(calls).toBe(1);
		expect((result.children[0] as Markdown.Code).content).toBe("let a = 1;");
	});

	test("fails when a handler removes the node the walk started from", () => {
		let doc = document([paragraph([text("body")])]);

		let result = Markdown.walk(doc, { document: () => null });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MarkdownWalkError);
		expect(result.error.position).toEqual(doc.position);
	});

	test("fails when a handler splices in place of the node the walk started from", () => {
		let doc = document([paragraph([text("body")])]);

		let result = Markdown.walk(doc, { document: (node) => [node] });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MarkdownWalkError);
		expect(result.error.message).toContain("handed back as one");
	});

	test("replaces the node the walk started from when the category holds", () => {
		let doc = document([paragraph([text("body")])]);

		let result = walked(
			Markdown.walk(doc, {
				document(node) {
					return { ...node, children: [heading([text("title")])] };
				},
			}),
		);

		expect(result.children.map((child) => child.type)).toEqual(["heading"]);
	});

	test("fails when a handler yields a node the surrounding slot cannot hold", () => {
		let inline = text("body", 7);
		let doc = document([paragraph([inline])]);

		let result = Markdown.walk(doc, {
			text() {
				return [code("let a = 1")] as unknown as Markdown.Inline[];
			},
		});

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toContain("code");
		expect(result.error.position).toEqual(inline.position);
	});

	test("shares every subtree no handler touched", () => {
		let doc = document([
			heading([text("title")]),
			paragraph([text("body")]),
			blockquote([paragraph([text("quoted")])]),
		]);

		let result = walked(
			Markdown.walk(doc, {
				heading(node) {
					return { ...node, level: 3 };
				},
			}),
		);

		expect(result).not.toBe(doc);
		expect(result.children[0]).not.toBe(doc.children[0]);
		expect(result.children[1]).toBe(doc.children[1]);
		expect(result.children[2]).toBe(doc.children[2]);
	});

	test("returns the same node when no handler changed anything", () => {
		let doc = document([paragraph([text("body")])]);

		let result = walked(Markdown.walk(doc, { text: () => undefined }));

		expect(result).toBe(doc);
	});

	test("leaves the input node untouched", () => {
		let doc = document([heading([text("title")]), code("let a = 1"), paragraph([text("body")])]);
		let before = structuredClone(doc);

		Markdown.walk(doc, {
			code: () => null,
			text(node) {
				return [text(node.value), text("extra")];
			},
			heading(node) {
				return { ...node, level: 4 };
			},
		});

		expect(doc).toEqual(before);
	});

	test("turns a throwing handler into a failure carrying the cause and the position", () => {
		let fence = code("let a = 1", 12);
		let doc = document([fence]);
		let boom = new Error("boom");

		let result = Markdown.walk(doc, {
			code() {
				throw boom;
			},
		});

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MarkdownWalkError);
		expect(result.error.cause).toBe(boom);
		expect(result.error.position).toEqual(fence.position);
		expect(result.error.message).toContain("boom");
	});

	test("turns a rejecting asynchronous handler into the same failure", async () => {
		let fence = code("let a = 1", 4);
		let doc = document([fence]);
		let boom = new Error("nope");

		let result = await Markdown.walk(doc, {
			code() {
				return Promise.reject(boom);
			},
		});

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.cause).toBe(boom);
		expect(result.error.position).toEqual(fence.position);
	});

	test("finishes a mixed synchronous and asynchronous visitor inside one promise", async () => {
		let doc = document([heading([text("title")]), code("let a = 1"), paragraph([text("body")])]);

		let result = await Markdown.walk(doc, {
			heading(node) {
				return { ...node, level: 3 };
			},
			async code(node) {
				await Promise.resolve();
				return { ...node, content: `${node.content};` };
			},
			text(node) {
				return { ...node, value: node.value.toUpperCase() };
			},
		});

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		let [first, second, third] = result.data.children;
		expect((first as Markdown.Heading).level).toBe(3);
		expect((second as Markdown.Code).content).toBe("let a = 1;");
		expect(((third as Markdown.Paragraph).children[0] as Markdown.Text).value).toBe("BODY");
	});

	test("answers a fully synchronous visitor without a promise", () => {
		let doc = document([paragraph([text("body")])]);

		let result = Markdown.walk(doc, SYNC_VISITOR);

		expect(result).not.toBeInstanceOf(Promise);
		expect(isSuccess(result)).toBe(true);
	});

	test("types the walk from the visitor's own handler return types", () => {
		let doc = document([paragraph([text("body")])]);

		expectTypeOf(Markdown.walk(doc, SYNC_VISITOR)).toEqualTypeOf<
			Result<Markdown.Document, Markdown.WalkError>
		>();
		expectTypeOf(Markdown.walk(doc, ASYNC_VISITOR)).toEqualTypeOf<
			Promise<Result<Markdown.Document, Markdown.WalkError>>
		>();
	});
});
