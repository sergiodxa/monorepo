/**
 * Tests the Markdown grammar against the documents this repository writes:
 * headings, tables, lists of links, and fenced blocks in other languages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { markdown } from "./markdown";

describe("markdown", () => {
	test("paints a heading apart from its marker", () => {
		let tokens = scan("## Status\n\nText.\n", markdown);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "##" },
			{ type: "keyword", value: " Status" },
			{ type: "plain", value: "\n\nText.\n" },
		]);
	});

	test("paints the code inside a heading as code", () => {
		let tokens = scan("#### `functionName()`\n", markdown);

		expect(tokens).toContainEqual({ type: "string", value: "`functionName()`" });
	});

	test("paints emphasis apart from its markers", () => {
		let tokens = scan("**Implemented** and _italic_ text\n", markdown);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "**" },
			{ type: "constant", value: "Implemented" },
			{ type: "punctuation", value: "**" },
			{ type: "plain", value: " and " },
			{ type: "punctuation", value: "_" },
			{ type: "constant", value: "italic" },
			{ type: "punctuation", value: "_" },
			{ type: "plain", value: " text\n" },
		]);
	});

	test("keeps an underscore inside a word out of emphasis", () => {
		let tokens = scan("The id_token_hint claim\n", markdown);

		expect(tokens).toEqual([{ type: "plain", value: "The id_token_hint claim\n" }]);
	});

	test("keeps an unpaired marker as text", () => {
		let tokens = scan("2 * 3 and a lone ** here\n", markdown);

		expect(tokens).toEqual([{ type: "plain", value: "2 * 3 and a lone ** here\n" }]);
	});

	test("paints inline code, whatever markers it holds", () => {
		let tokens = scan("Run `bun run dev` on `apps/blog/**/*.tsx`\n", markdown);

		expect(tokens.filter((token) => token.type === "string").map((token) => token.value)).toEqual([
			"`bun run dev`",
			"`apps/blog/**/*.tsx`",
		]);
	});

	test("paints a link's destination apart from its brackets", () => {
		let tokens = scan("See [ADR-005](./ADR-005-improved-approach.md) for more\n", markdown);

		expect(tokens).toEqual([
			{ type: "plain", value: "See " },
			{ type: "punctuation", value: "[" },
			{ type: "plain", value: "ADR-005" },
			{ type: "punctuation", value: "](" },
			{ type: "attr-value", value: "./ADR-005-improved-approach.md" },
			{ type: "punctuation", value: ")" },
			{ type: "plain", value: " for more\n" },
		]);
	});

	test("paints an image the same way, marker included", () => {
		let tokens = scan("![A chart](/assets/chart.png)\n", markdown);

		expect(tokens[0]).toEqual({ type: "punctuation", value: "![" });
		expect(tokens).toContainEqual({ type: "attr-value", value: "/assets/chart.png" });
	});

	test("keeps a checklist's brackets and a paren in prose as text", () => {
		let tokens = scan("- [x] Done (RFC 6749)\n", markdown);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "-" },
			{ type: "plain", value: " [x] Done (RFC 6749)\n" },
		]);
	});

	test("paints a list marker only where a line starts one", () => {
		let tokens = scan("- One - still one\n1. Two\n", markdown);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "-" },
			{ type: "plain", value: " One - still one\n" },
			{ type: "punctuation", value: "1." },
			{ type: "plain", value: " Two\n" },
		]);
	});

	test("paints a block quote and a horizontal rule", () => {
		let tokens = scan("> Quoted\n\n---\n", markdown);

		expect(
			tokens.filter((token) => token.type === "punctuation").map((token) => token.value),
		).toEqual([">", "---"]);
	});

	test("keeps an escaped marker as text", () => {
		let tokens = scan("\\`\\`\\`bash\nbun run cf:deploy\n\\`\\`\\`\n", markdown);

		expect(tokens).toEqual([
			{ type: "plain", value: "\\`\\`\\`bash\nbun run cf:deploy\n\\`\\`\\`\n" },
		]);
	});

	test("paints a fence's language and leaves its body plain", () => {
		let code = '```tsx path="app/root.tsx"\nexport default function Root() {}\n```\n';

		let tokens = scan(code, markdown);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens).toEqual([
			{ type: "punctuation", value: "```" },
			{ type: "keyword", value: "tsx" },
			{ type: "attr-value", value: ' path="app/root.tsx"' },
			{ type: "plain", value: "\nexport default function Root() {}\n" },
			{ type: "punctuation", value: "```" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("leaves markup inside a fence unpainted", () => {
		let tokens = scan("```hcl\n<img src=x onerror=alert(1)>\n```\n", markdown);

		expect(tokens).toContainEqual({ type: "plain", value: "\n<img src=x onerror=alert(1)>\n" });
	});

	test("paints a table's pipes and its delimiter row", () => {
		let code = [
			"### Cron Triggers",
			"",
			"| Schedule    | Purpose              |",
			"| ----------- | -------------------- |",
			"| `* * * * *` | Process pending jobs |",
			"",
		].join("\n");

		let tokens = scan(code, markdown);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens).toContainEqual({ type: "string", value: "`* * * * *`" });
		expect(tokens.filter((token) => token.type === "punctuation")).toContainEqual({
			type: "punctuation",
			value: "-----------",
		});
	});
});
