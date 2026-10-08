/**
 * Checks the content linter: each built-in rule on a document that breaks it and one
 * that keeps it, turning rules off, custom rules, and problems ordered by where they
 * sit in the source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Markdown } from "../index.js";

import { lint } from "./lint.js";

/** An allowlist with the two elements the rules read: links and images. */
const OPTIONS = {
	html: { a: ["href"], img: ["src", "alt"] },
} satisfies Markdown.Options;

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): Markdown.Document {
	return unwrap(Markdown.parse(source, OPTIONS)).document;
}

/**
 * @param source - The markdown to lint
 * @param options - The rule toggles and extras to lint with
 * @returns The rule names of every problem, in order
 */
function rules(source: string, options?: Parameters<typeof lint>[1]): string[] {
	return lint(parse(source), options).map((problem) => problem.rule);
}

describe("lint", () => {
	test("returns no problems for a clean document", () => {
		let source = [
			"# Title",
			"",
			"## Install {% #setup %}",
			"",
			"See [setup](#setup) and [usage](#usage).",
			"",
			"### Usage",
			"",
			"```ts",
			"let a = 1;",
			"```",
			"",
			"![A cat](cat.png)",
		].join("\n");

		expect(lint(parse(source))).toEqual([]);
	});

	describe("code-language", () => {
		test("reports a code block with no language at its position", () => {
			let problems = lint(parse("Text\n\n```\nlet a = 1;\n```"));

			expect(problems).toEqual([
				{
					rule: "code-language",
					message: "Code block has no language",
					position: expect.objectContaining({ start: expect.objectContaining({ line: 3 }) }),
				},
			]);
		});

		test("reports indented code, which carries no language", () => {
			expect(rules("Text\n\n    let a = 1;")).toEqual(["code-language"]);
		});

		test("accepts a fenced block with a language", () => {
			expect(rules("```js\nlet a = 1;\n```")).toEqual([]);
		});
	});

	describe("heading-increment", () => {
		test("reports a heading that skips a level", () => {
			let problems = lint(parse("## One\n\n#### Two"));

			expect(problems).toMatchObject([
				{
					rule: "heading-increment",
					message: "Heading level 4 follows level 2; expected level 3 or less",
					position: { start: { line: 3, column: 1 } },
				},
			]);
		});

		test("lets the first heading be any level, and a later one go back up", () => {
			expect(rules("### One\n\n#### Two\n\n# Three\n\n## Four")).toEqual([]);
		});

		test("reads headings nested in other blocks in document order", () => {
			expect(rules("# One\n\n> ### Two")).toEqual(["heading-increment"]);
		});
	});

	describe("single-h1", () => {
		test("reports every level-1 heading after the first", () => {
			let problems = lint(parse("# One\n\n# Two\n\n# Three"));

			expect(problems).toMatchObject([
				{ rule: "single-h1", position: { start: { line: 3 } } },
				{ rule: "single-h1", position: { start: { line: 5 } } },
			]);
		});

		test("accepts one level-1 heading", () => {
			expect(rules("# One\n\n## Two")).toEqual([]);
		});
	});

	describe("image-alt", () => {
		test("reports an image with no alternative text", () => {
			let problems = lint(parse("Look ![](cat.png)"));

			expect(problems).toMatchObject([
				{ rule: "image-alt", position: { start: { line: 1, column: 6 } } },
			]);
		});

		test("reports an image whose alternative text is only whitespace", () => {
			expect(rules("![  ](cat.png)")).toEqual(["image-alt"]);
		});

		test("reports an img element without a non-empty alt", () => {
			expect(rules('<img src="a.png">\n\n<img src="b.png" alt="">')).toEqual([
				"image-alt",
				"image-alt",
			]);
		});

		test("accepts images that describe themselves", () => {
			expect(rules('![A cat](cat.png) <img src="a.png" alt="A dog">')).toEqual([]);
		});
	});

	describe("empty-link", () => {
		test("reports a link with an empty href", () => {
			expect(rules("[Docs]()")).toEqual(["empty-link"]);
		});

		test("reports a link with no text", () => {
			let problems = lint(parse("Go [](https://example.com) now"));

			expect(problems).toMatchObject([
				{ rule: "empty-link", position: { start: { line: 1, column: 4 } } },
			]);
		});

		test("reports an a element with no text", () => {
			expect(rules('<a href="https://example.com"></a>')).toEqual(["empty-link"]);
		});

		test("accepts a link with text and a target", () => {
			expect(rules("[Docs](https://example.com)")).toEqual([]);
		});
	});

	describe("broken-anchor", () => {
		test("reports a fragment that matches no id", () => {
			let problems = lint(parse("# Title\n\nSee [usage](#usage)."));

			expect(problems).toMatchObject([
				{
					rule: "broken-anchor",
					message: "Link points at #usage, which no heading or block in the document has",
					position: { start: { line: 3, column: 5 } },
				},
			]);
		});

		test("resolves a fragment against a heading's GitHub slug", () => {
			expect(rules("## Hello, World!\n\n[Jump](#hello-world)")).toEqual([]);
		});

		test("numbers repeated headings the way GitHub does", () => {
			expect(rules("## Props\n\n## Props\n\n[a](#props) [b](#props-1)")).toEqual([]);
			expect(rules("## Props\n\n[a](#props-1)")).toEqual(["broken-anchor"]);
		});

		test("resolves an explicit id, and reserves it ahead of the slugs", () => {
			let source = "## Setup\n\n## Install {% #setup %}\n\n[a](#setup) [b](#setup-1)";
			expect(rules(source)).toEqual([]);
		});

		test("drops the slug of a heading that carries an explicit id", () => {
			expect(rules("## Install {% #setup %}\n\n[a](#install)")).toEqual(["broken-anchor"]);
		});

		test("resolves an id annotated on any block", () => {
			expect(rules("{% #intro %}\nSome text.\n\n[a](#intro)")).toEqual([]);
		});

		test("checks the href of an a element", () => {
			expect(rules('<a href="#missing">Jump</a>')).toEqual(["broken-anchor"]);
		});

		test("decodes a percent-encoded fragment", () => {
			expect(rules("## Café\n\n[a](#caf%C3%A9)")).toEqual([]);
		});

		test("accepts ids the caller knows from outside the document", () => {
			expect(rules("[a](#comments)", { ids: ["comments"] })).toEqual([]);
		});

		test("leaves links to other pages and a bare # alone", () => {
			expect(rules("[a](/docs#missing) [b](#)")).toEqual([]);
		});
	});

	describe("duplicate-id", () => {
		test("reports every block after the first that claims an id", () => {
			let source = "## One {% #same %}\n\n## Two {% #same %}";
			let problems = lint(parse(source));

			expect(problems).toMatchObject([
				{
					rule: "duplicate-id",
					message: "Id #same is already used by an earlier block",
					position: { start: { line: 3 } },
				},
			]);
		});

		test("accepts distinct ids", () => {
			expect(rules("## One {% #a %}\n\n## Two {% #b %}")).toEqual([]);
		});
	});

	describe("options.rules", () => {
		test("turns a rule off", () => {
			let source = "# One\n\n# Two\n\n```\nx\n```";
			expect(rules(source, { rules: { "single-h1": false } })).toEqual(["code-language"]);
			expect(rules(source, { rules: { "code-language": false, "single-h1": false } })).toEqual([]);
		});

		test("turns a custom rule off by its name", () => {
			let custom = {
				"no-todo": (node: Markdown.Node, report: (message: string) => void) => {
					if (node.type === "text" && node.value.includes("TODO")) report("TODO left in");
				},
			};
			expect(rules("TODO", { custom, rules: { "no-todo": false } })).toEqual([]);
		});
	});

	describe("options.custom", () => {
		test("reports at the node by default, or at a given position", () => {
			let problems = lint(parse("Intro\n\nA TODO here"), {
				custom: {
					"no-todo"(node, report) {
						if (node.type === "text" && node.value.includes("TODO")) report("TODO left in");
					},
					"no-document"(node, report) {
						if (node.type === "document") {
							report("Whole document", {
								start: { line: 1, column: 1, offset: 0 },
								end: { line: 1, column: 2, offset: 1 },
							});
						}
					},
				},
			});

			expect(problems).toMatchObject([
				{ rule: "no-document", message: "Whole document", position: { start: { offset: 0 } } },
				{ rule: "no-todo", message: "TODO left in", position: { start: { line: 3 } } },
			]);
		});
	});

	test("orders problems by their position in the source", () => {
		let source = ["# One", "", "```", "x", "```", "", "# Two", "", "![](a.png)"].join("\n");
		let problems = lint(parse(source));

		expect(problems.map((problem) => [problem.rule, problem.position.start.line])).toEqual([
			["code-language", 3],
			["single-h1", 7],
			["image-alt", 9],
		]);
	});
});
