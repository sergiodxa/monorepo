/**
 * Tests for the markup a code view serves: a 10,000-line file stays within a fixed node
 * budget per line, in chunks, with one island for the whole view; `?L=` lines arrive
 * painted; blame cells span their hunk and split where a chunk ends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { tokenize } from "@sdxc/highlight";
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { CodeView, codeStats } from "./code-view.js";

const LABELS: CodeView.Labels = {
	lineMenu: "Line options",
	copyLine: "Copy line",
	copyPermalink: "Copy permalink",
	copied: "Copied",
};

/**
 * Elements every line costs on top of its runs: the row, the number cell, the number link
 * and the code cell. The number is an attribute painted by CSS, so it adds no text node.
 */
const CHROME_ELEMENTS_PER_LINE = 4;

/**
 * Ceiling on nodes per line for the TypeScript fixture, runs included. Four elements of
 * chrome plus a typical line's dozen-odd runs (keywords, names, punctuation) as a span and
 * a text node each, with merged plain runs as one text node, stays well under 30; a row
 * component, a span per plain run or a text node for the number would each break it.
 */
const NODES_PER_LINE_CEILING = 30;

/** A TypeScript file of `lines` lines, repeating a small module's shapes. */
function fixture(lines: number): string {
	let shapes = [
		'import { tokenize } from "@sdxc/highlight";',
		"",
		"/** Counts the runs of one line. */",
		"export function count(line: string, limit = 2_000): number {",
		"\tlet total = 0;",
		"\tfor (let index = 0; index < line.length && index < limit; index += 1) total += 1;",
		"\treturn total; // done",
		"}",
	];
	return Array.from({ length: lines }, (_, index) => shapes[index % shapes.length]).join("\n");
}

/** Server HTML for `node`, without the stylesheets the head carries. */
async function body(node: JSX.Element): Promise<string> {
	let html = await renderToString(node);
	return html.slice(html.indexOf("</head>"));
}

/** How many times `pattern` occurs in `html`. */
function occurrences(html: string, pattern: RegExp): number {
	return html.match(pattern)?.length ?? 0;
}

describe("CodeView on a 10,000-line file", () => {
	let code = fixture(10_000);
	let rendered = body(<CodeView path="big.ts" language="ts" code={code} labels={LABELS} />);

	test("draws one row per line in chunks of 200", async () => {
		let html = await rendered;
		expect(occurrences(html, /<tr[ >]/g)).toBe(10_000);
		expect(occurrences(html, /<tbody[ >]/g)).toBe(50);
		expect(html).toContain(
			'<a id="L10000" href="?L=10000#L10000" data-line-number="10000" tabindex="-1"></a>',
		);
		expect(occurrences(html, /tabindex="0"/g)).toBe(1);
	});

	test("hydrates one island for the whole view, none per row", async () => {
		let html = await rendered;
		expect(occurrences(html, /<!-- rmx:h:/g)).toBe(1);
		expect(occurrences(html, /"moduleUrl":"@sdxc\/ui\/app\/code-view"/g)).toBe(1);
	});

	test("costs four elements of chrome per line and no class on a row", async () => {
		let html = await rendered;
		let chrome =
			occurrences(html, /<tr[ >]/g) +
			occurrences(html, /<td[ >]/g) +
			occurrences(html, /<a id="L\d+"/g);
		expect(chrome).toBe(10_000 * CHROME_ELEMENTS_PER_LINE);
		expect(occurrences(html, /<tr class=/g)).toBe(0);
		expect(occurrences(html, /<td class=/g)).toBe(0);
	});

	test("wraps only highlighted runs in spans, and stays under the node ceiling", async () => {
		let html = await rendered;
		let rows = html.slice(html.indexOf("<tbody"), html.lastIndexOf("</tbody>"));
		let spans = occurrences(rows, /<span[ >]/g);
		let highlighted = occurrences(rows, /<span class="token [a-z-]+">/g);
		let texts = occurrences(rows, />[^<]+</g);
		let nodes = 10_000 * CHROME_ELEMENTS_PER_LINE + spans + texts;

		expect(spans).toBe(highlighted);
		expect(nodes / 10_000).toBeLessThan(NODES_PER_LINE_CEILING);
	});
});

describe("CodeView markup", () => {
	test("paints the lines a ?L= range cites, before any script", async () => {
		let html = await body(
			<CodeView path="a.ts" code={"a\nb\nc\nd"} selected={{ start: 2, end: 3 }} labels={LABELS} />,
		);
		expect(html).toContain('data-selection="2-3"');
		expect(occurrences(html, /<tr data-selected="">/g)).toBe(2);
		expect(html).toMatch(/<tr data-selected=""><td><a id="L2"/);
	});

	test("links each number through lineHref", async () => {
		let html = await body(
			<CodeView
				path="a.ts"
				code="a"
				lineHref={(line) => `/blob/main/a.ts?L=${line}#L${line}`}
				labels={LABELS}
			/>,
		);
		expect(html).toContain('href="/blob/main/a.ts?L=1#L1"');
	});

	test("draws no line for a trailing newline", async () => {
		let html = await body(<CodeView path="a.ts" code={"a\nb\n"} labels={LABELS} />);
		expect(occurrences(html, /<tr[ >]/g)).toBe(2);
		expect(codeStats("a\n\nb\n")).toEqual({ lines: 3, loc: 2, bytes: 5 });
	});

	test("draws a highlighted token as a span and plain text bare", async () => {
		let html = await body(
			<CodeView
				path="a.ts"
				code="let a = 1;"
				tokens={tokenize("let a = 1;", "ts")}
				labels={LABELS}
			/>,
		);
		expect(html).toContain('<span class="token keyword">let</span> a ');
	});

	test("spans each blame hunk's rows and splits a hunk where a chunk ends", async () => {
		let commit = (sha: string, date: string) => ({
			sha,
			subject: `Commit ${sha}`,
			author: "Ann",
			date,
			href: `/commit/${sha}`,
		});
		let html = await body(
			<CodeView
				path="a.ts"
				code={Array.from({ length: 6 }, (_, index) => `line ${index + 1}`).join("\n")}
				chunkSize={4}
				now="2026-11-13"
				blame={[
					{ start: 1, end: 2, commit: commit("old", "2025-01-01") },
					{ start: 3, end: 6, commit: commit("new", "2026-11-01") },
				]}
				labels={LABELS}
			/>,
		);
		let cells = [...html.matchAll(/<td data-blame=""([^>]*)>/g)].map((match) => match[1]!);

		expect(cells).toHaveLength(3);
		expect(cells[0]).toMatch(/data-age="1".*rowspan="2"/);
		expect(cells[1]).toMatch(/data-age="5".*rowspan="2"/);
		expect(cells[2]).toMatch(/data-continued="".*rowspan="2"/);
		expect(occurrences(html, /Commit new/g)).toBe(2);
		expect(html).toContain('href="/commit/new"');
	});
});
