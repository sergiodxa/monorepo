/**
 * Tests for the comment parser: the boundary between prose and block tags, the
 * alias collapsing a renderer depends on, and the fenced code an `@example`
 * carries without its contents leaking out as tags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { parseComment } from "./comment.js";

describe("parseComment", () => {
	test("reads the prose written before the first tag", () => {
		let comment = parseComment(`/**
 * Adds two numbers.
 *
 * The second addend defaults to one.
 *
 * @returns The sum.
 */`);

		expect(comment.description).toBe("Adds two numbers.\n\nThe second addend defaults to one.");
		expect(comment.tags).toEqual([{ tag: "returns", name: null, type: null, text: "The sum." }]);
	});

	test("accepts a comment whose markers were already stripped", () => {
		expect(parseComment("Adds two numbers.")).toEqual({
			description: "Adds two numbers.",
			tags: [],
		});
	});

	test("splits the name, the braced type and the text of a tag", () => {
		let [tag] = parseComment("/** @param {string} name - The subject. */").tags;

		expect(tag).toEqual({ tag: "param", name: "name", type: "string", text: "The subject." });
	});

	test("counts nested braces so an object type survives", () => {
		let [tag] = parseComment("/** @param {{ id: string }} user - The user. */").tags;

		expect(tag?.type).toBe("{ id: string }");
		expect(tag?.text).toBe("The user.");
	});

	test("collapses aliases onto one spelling per concept", () => {
		let comment = parseComment(`/**
 * @arg a - Left.
 * @argument b - Right.
 * @return The sum.
 * @exception When either side is missing.
 */`);

		expect(comment.tags.map((tag) => tag.tag)).toEqual(["param", "param", "returns", "throws"]);
	});

	test("keeps the continuation lines of a tag with its tag", () => {
		let comment = parseComment(`/**
 * @param options - The options,
 * spread over two lines.
 * @param other - The other one.
 */`);

		expect(comment.tags[0]?.text).toBe("The options,\nspread over two lines.");
		expect(comment.tags[1]?.text).toBe("The other one.");
	});

	test("leaves the tags of fenced code inside the example that contains them", () => {
		let comment = parseComment(`/**
 * Wraps a function.
 *
 * @example
 * \`\`\`ts
 * /** @param a - Inner. *\\/
 * let wrapped = wrap(add);
 * \`\`\`
 * @see wrap
 */`);

		expect(comment.tags.map((tag) => tag.tag)).toEqual(["example", "see"]);
		expect(comment.tags[0]?.text).toContain("@param a - Inner.");
	});

	test("unwraps the optional syntax so the name matches its parameter", () => {
		let comment = parseComment(`/**
 * @param [count=0] - How many.
 * @param [label] - What to call it.
 */`);

		expect(comment.tags.map((tag) => tag.name)).toEqual(["count", "label"]);
	});

	test("reads a template constraint written in braces", () => {
		let [tag] = parseComment("/** @template {string} K - The key. */").tags;

		expect(tag).toEqual({ tag: "template", name: "K", type: "string", text: "The key." });
	});

	test("treats a leading inline link as text rather than a type", () => {
		let [tag] = parseComment("/** @see {@link parseComment} for the grammar. */").tags;

		expect(tag?.type).toBeNull();
		expect(tag?.text).toBe("{@link parseComment} for the grammar.");
	});

	test("reads a tag that carries no text at all", () => {
		expect(parseComment("/** Old.\n * @deprecated\n */").tags).toEqual([
			{ tag: "deprecated", name: null, type: null, text: "" },
		]);
	});
});
