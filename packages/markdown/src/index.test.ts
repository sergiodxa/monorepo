/**
 * The package's surface, checked end to end: the two reading entries over one
 * options object, the round trip the serializer promises, and the dialect the
 * parser adds to GitHub's. Each case is a claim the design document makes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { Markdown } from "./index.js";

const FRONTMATTER = s.object({ title: s.string() });

/** The document alone, which every serialization assertion here compares against. */
function write(source: string, options?: Markdown.Options): string {
	return unwrap(Markdown.stringify(unwrap(Markdown.parse(source, options)).document));
}

describe("Markdown.parse", () => {
	test("reads the frontmatter and the body in one call", () => {
		let parsed = unwrap(
			Markdown.parse("---\ntitle: Hi\n---\n\n# Heading\n", { frontmatter: FRONTMATTER }),
		);

		expect(parsed.frontmatter.title).toBe("Hi");
		expect(parsed.document.children[0]).toMatchObject({ type: "heading", level: 1 });
	});

	test("positions index the file as written, frontmatter included", () => {
		let parsed = unwrap(Markdown.parse("---\ntitle: Hi\n---\n\n# Heading\n"));

		expect(parsed.document.children[0]?.position.start.line).toBe(5);
	});

	test("runs the schema against an empty object when the file opens with no block", () => {
		let result = Markdown.parse("# Heading\n", { frontmatter: FRONTMATTER });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error.issues.length).toBeGreaterThan(0);
	});

	test("reads the block as it stands when no schema is given", () => {
		let parsed = unwrap(Markdown.parse("---\ntitle: Hi\n---\n"));

		expect(parsed.frontmatter).toEqual({ title: "Hi" });
	});
});

describe("Markdown.frontmatter", () => {
	test("stops after the block, so one options object serves both entries", () => {
		let options = { frontmatter: FRONTMATTER } satisfies Markdown.Options;
		let read = unwrap(Markdown.frontmatter("---\ntitle: Hi\n---\n\n# Heading\n", options));

		expect(read.frontmatter.title).toBe("Hi");
	});
});

describe("the GitHub dialect", () => {
	test("parses an alert as its own node, carrying its kind", () => {
		let parsed = unwrap(Markdown.parse("> [!WARNING]\n> Careful.\n"));

		expect(parsed.document.children[0]).toMatchObject({ type: "alert", kind: "warning" });
	});

	test("parses a table with the alignment its delimiter row asked for", () => {
		let parsed = unwrap(Markdown.parse("| a | b |\n| :- | -: |\n| 1 | 2 |\n"));

		expect(parsed.document.children[0]).toMatchObject({ type: "table", align: ["left", "right"] });
	});

	test("parses a task list item's box", () => {
		let parsed = unwrap(Markdown.parse("- [x] done\n- [ ] not\n"));
		let list = parsed.document.children[0];

		expect(list).toMatchObject({ type: "list" });
		if (list?.type !== "list") return;

		expect(list.children.map((item) => item.checked)).toEqual([true, false]);
	});

	test("keeps both halves of a footnote", () => {
		let parsed = unwrap(Markdown.parse("Text.[^a]\n\n[^a]: The note.\n"));
		let types = parsed.document.children.map((child) => child.type);

		expect(types).toContain("footnoteDefinition");
	});

	test("renders raw HTML as a node holding its source", () => {
		let parsed = unwrap(Markdown.parse("<div>raw</div>\n"));

		expect(parsed.document.children[0]).toMatchObject({ type: "html" });
	});
});

describe("annotations and tags", () => {
	test("attaches an annotation written on a heading's own line", () => {
		let parsed = unwrap(Markdown.parse("## Installing {% #install .lead %}\n"));

		expect(parsed.document.children[0]).toMatchObject({
			type: "heading",
			attributes: { id: "install", class: "lead" },
		});
	});

	test("attaches an annotation written above a block, across a blank line", () => {
		let parsed = unwrap(Markdown.parse("{% .wide %}\n\n| a |\n| - |\n| 1 |\n"));

		expect(parsed.document.children[0]).toMatchObject({
			type: "table",
			attributes: { class: "wide" },
		});
	});

	test("fails at its own line when an annotation has no block after it", () => {
		let result = Markdown.parse("Text.\n\n{% .wide %}\n");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error.position?.start.line).toBe(3);
	});

	test("reads a registered element as a tag whose children are markdown", () => {
		let parsed = unwrap(
			Markdown.parse('<callout type="warning">\n**Heads up**\n</callout>\n', {
				tags: { callout: {} },
			}),
		);
		let tag = parsed.document.children[0];

		expect(tag).toMatchObject({ type: "tag", name: "callout", attributes: { type: "warning" } });
		if (tag?.type !== "tag") return;

		expect(tag.children[0]).toMatchObject({ type: "paragraph" });
	});

	test("leaves an unregistered element as raw HTML", () => {
		let parsed = unwrap(Markdown.parse("<callout>\nText\n</callout>\n"));

		expect(parsed.document.children[0]?.type).toBe("html");
	});

	test("fails at the opener when a block tag never closes", () => {
		let result = Markdown.parse("<callout>\nText\n", { tags: { callout: {} } });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error.position?.start.line).toBe(1);
	});
});

describe("variables", () => {
	test("parses a hole without substituting anything", () => {
		let parsed = unwrap(Markdown.parse("Live at {% $domain %}.\n"));
		let paragraph = parsed.document.children[0];

		expect(paragraph?.type).toBe("paragraph");
		if (paragraph?.type !== "paragraph") return;

		expect(paragraph.children.some((child) => child.type === "variable")).toBe(true);
	});

	test("leaves a bare dollar sign as prose", () => {
		expect(write("Plans start at $5/month.\n")).toBe("Plans start at $5/month.\n");
	});

	test("round-trips a hole, so a cached document renders per tenant", () => {
		expect(write("Live at {% $domain %}.\n")).toBe("Live at {% $domain %}.\n");
	});
});

describe("the round trip", () => {
	test("is idempotent over every construct the dialect has", () => {
		let source = [
			"# Heading",
			"",
			"A paragraph with **strong**, _emphasis_, `code`, a [link](https://example.com) and",
			"<https://example.com>.",
			"",
			"> [!NOTE]",
			"> An alert.",
			"",
			"- [x] a task",
			"- a plain item",
			"",
			"1. first",
			"2. second",
			"",
			"| a   | b   |",
			"| --- | --: |",
			"| 1   | 2   |",
			"",
			"```ts",
			"let x = 1;",
			"```",
			"",
			"---",
			"",
			"Text.[^a]",
			"",
			"[^a]: The note.",
			"",
		].join("\n");

		let once = write(source);

		expect(write(once)).toBe(once);
	});

	test("escapes text a visitor wrote, so the next parse reads the same tree", () => {
		let parsed = unwrap(Markdown.parse("placeholder\n"));
		let rewritten = unwrap(
			Markdown.walk(parsed.document, {
				text(node) {
					return { ...node, value: "<callout> and {% $9 %} and *stars*" };
				},
			}),
		);

		let written = unwrap(Markdown.stringify(rewritten));
		let reread = unwrap(Markdown.parse(written)).document;

		expect(unwrap(Markdown.stringify(reread))).toBe(written);
	});

	test("writes the frontmatter back when it is given one", () => {
		let written = unwrap(
			Markdown.stringify(unwrap(Markdown.parse("# Heading\n")).document, {
				frontmatter: { title: "Hi" },
			}),
		);

		expect(written.startsWith("---\ntitle: Hi\n---\n")).toBe(true);
	});
});
