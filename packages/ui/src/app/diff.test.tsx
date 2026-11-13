/**
 * Tests for the markup a diff page serves: a 300-file, 20,000-line change stays within a
 * fixed node budget per line, in skippable chunks, with one island for the page and its large
 * files closed; rows, signs, marks, threads and links arrive drawn without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk, Line } from "@sdxc/diff";

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Diff } from "./diff.js";

const FILE_LABELS: Diff.FileLabels = {
	columns: {
		oldNumber: "Original file line number",
		newNumber: "Diff line number",
		oldText: "Original file line",
		change: "Diff line change",
	},
	expandContext: "Expand context",
	addComment: (side, line) => `Comment on line ${side}${line}`,
	copyPath: "Copy file path",
	statuses: {
		added: "Added",
		modified: "Modified",
		deleted: "Deleted",
		renamed: "Renamed",
		copied: "Copied",
	},
	changes: (additions, deletions) => `${additions} additions, ${deletions} deletions`,
	binary: "Binary file not shown.",
	tooLarge: "Large diff not shown.",
	largeDiff: "Large diffs are not rendered by default.",
	empty: "File renamed without changes.",
};

/** Files in the stress change, three of them past the large-file threshold. */
const FILES = 300;

/** Large files in the stress change, each with {@link LARGE_PAIRS} changed pairs. */
const LARGE_FILES = 3;

/** Changed pairs (one deletion and one addition) per large file: 727 pairs is 1,454 lines. */
const LARGE_PAIRS = 727;

/** Hunks per ordinary file, each with five changed pairs between three lines of context. */
const HUNKS_PER_FILE = 6;

/** Changed pairs per hunk of an ordinary file. */
const PAIRS_PER_HUNK = 5;

/**
 * Elements a unified line costs before its runs: the row, three cells, up to two number
 * links and the `+` link. Numbers are attributes painted by CSS, so they add no text node.
 */
const CHROME_ELEMENTS_PER_LINE = 7;

/**
 * Nodes per drawn line, runs included: seven of chrome, a span and text node per highlighted
 * run, merged plain text and one `<mark>` per changed word measure about 25 on this fixture.
 * A row component, a sign cell, a text node per number or a span per plain run breaks 30.
 */
const NODES_PER_LINE_CEILING = 30;

/** The TypeScript shapes every line of the fixture repeats. */
const SHAPES = [
	"export function count(line: string, limit = 2_000): number {",
	"\tlet total = 0;",
	"\tfor (let index = 0; index < line.length; index += 1) total += 1;",
	"\treturn total; // done",
	"}",
];

/** A hunk of three context lines, `pairs` changed pairs with one changed word each, and three more. */
function hunk(start: number, pairs: number): Hunk {
	let lines: Line[] = [];
	let old = start;
	let next = start;
	let context = (count: number) => {
		for (let index = 0; index < count; index += 1) {
			lines.push({
				kind: "context",
				old: old++,
				new: next++,
				text: SHAPES[index % SHAPES.length]!,
			});
		}
	};
	context(3);
	for (let pair = 0; pair < pairs; pair += 1) {
		lines.push({ kind: "del", old: old++, text: "\tlet total = 0;", words: [[12, 13]] });
	}
	for (let pair = 0; pair < pairs; pair += 1) {
		lines.push({ kind: "add", new: next++, text: "\tlet total = 1;", words: [[12, 13]] });
	}
	context(3);
	return {
		oldStart: start,
		oldLines: old - start,
		newStart: start,
		newLines: next - start,
		section: "export function count(line: string): number {",
		lines,
	};
}

/** The stress change: ordinary files of six hunks, then the large files. */
function stressFiles() {
	return Array.from({ length: FILES }, (_, index) => {
		let large = index >= FILES - LARGE_FILES;
		let hunks = large
			? [hunk(1, LARGE_PAIRS)]
			: Array.from({ length: HUNKS_PER_FILE }, (_, position) =>
					hunk(1 + position * 40, PAIRS_PER_HUNK),
				);
		let changed = hunks.reduce(
			(sum, item) => sum + item.lines.filter((line) => line.kind !== "context").length,
			0,
		);
		return {
			path: `src/module-${index}.ts`,
			hunks,
			additions: changed / 2,
			deletions: changed / 2,
			large,
		};
	});
}

/** Server HTML for `node`, without the stylesheets the head carries. */
async function body(node: JSX.Element): Promise<string> {
	let html = await renderToString(node);
	return html.slice(html.indexOf("</head>"));
}

/** `html` without its hidden column headers, so only drawn rows remain. */
function withoutHeaders(html: string): string {
	return html.replaceAll(/<thead>.*?<\/thead>/g, "");
}

/** How many times `pattern` occurs in `html`. */
function occurrences(html: string, pattern: RegExp): number {
	return html.match(pattern)?.length ?? 0;
}

describe("Diff on a 300-file, 20,000-line change", () => {
	let files = stressFiles();
	let changed = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
	let drawnLines = files
		.filter((file) => !file.large)
		.reduce(
			(sum, file) => sum + file.hunks.reduce((total, item) => total + item.lines.length, 0),
			0,
		);
	let rendered = body(
		<Diff labels={{ copied: "Copied" }}>
			{files.map((file) => (
				<Diff.File
					path={file.path}
					status="modified"
					additions={file.additions}
					deletions={file.deletions}
					hunks={file.hunks}
					language="ts"
					commentHref={(path, side, line) => `?comment=${path}:${side}${line}`}
					load={<a href={`/diff/${file.path}`}>Load diff</a>}
					labels={FILE_LABELS}
				/>
			))}
		</Diff>,
	);

	test("holds at least 20,000 changed lines", () => {
		expect(changed).toBeGreaterThanOrEqual(20_000);
	});

	test("hydrates one island for the whole page, none per file or row", async () => {
		let html = await rendered;
		expect(occurrences(html, /<!-- rmx:h:/g)).toBe(1);
		expect(occurrences(html, /"moduleUrl":"@sdxc\/ui\/app\/diff"/g)).toBe(1);
	});

	test("renders large files closed, with the app's load slot and no rows", async () => {
		let html = await rendered;
		let large = html
			.split('data-slot="diff-file"')
			.filter((part) => part.includes('data-large=""'));
		expect(large).toHaveLength(LARGE_FILES);
		for (let file of large) {
			let details = /<details[^>]*>/.exec(file)![0];
			expect(details).not.toContain("open");
			expect(file).toContain("Load diff");
			expect(file).not.toContain("<tbody");
		}
		expect(occurrences(html, /<details open/g)).toBe(FILES - LARGE_FILES);
	});

	test("puts rows in chunks the browser skips, sized before they lay out", async () => {
		let html = withoutHeaders(await rendered);
		let rows = occurrences(html, /<tr(?: data-kind="(?:add|del)")?>/g);
		expect(rows).toBe(drawnLines);
		expect(occurrences(html, /<tbody class=/g)).toBe(occurrences(html, /<tbody[ >]/g));
		expect(
			await renderToString(<Diff.Hunks path="a.ts" hunks={files[0]!.hunks} labels={FILE_LABELS} />),
		).toMatch(/content-visibility: ?auto/);
	});

	test("costs seven elements of chrome per line, no class on a row, and stays under the ceiling", async () => {
		let html = await rendered;
		let rows = [...html.matchAll(/<tbody[^>]*>(.*?)<\/tbody>/g)].map((match) => match[1]).join("");
		let lineRows = occurrences(rows, /<tr(?: data-kind="(?:add|del)")?>/g);
		let elements = occurrences(rows, /<(?:tr|td|a|span|mark)[ >]/g);
		let texts = occurrences(rows, />[^<]+</g);

		expect(occurrences(rows, /<tr class=/g)).toBe(0);
		expect(occurrences(rows, /<td class=/g)).toBe(0);
		expect(occurrences(rows, /<a href="\?comment=/g)).toBe(lineRows);
		expect(occurrences(rows, /<span[ >]/g)).toBe(
			occurrences(rows, /<span class="token [a-z-]+">/g),
		);
		expect((elements + texts) / lineRows).toBeLessThan(NODES_PER_LINE_CEILING);
		expect(CHROME_ELEMENTS_PER_LINE).toBeLessThan(NODES_PER_LINE_CEILING);
	});
});

describe("Diff markup", () => {
	let change: Hunk = {
		oldStart: 10,
		oldLines: 3,
		newStart: 10,
		newLines: 3,
		section: "function total()",
		lines: [
			{ kind: "context", old: 10, new: 10, text: "let a = 1;" },
			{ kind: "del", old: 11, text: "let b = 2;", words: [[8, 9]] },
			{ kind: "add", new: 11, text: "let b = 3;", words: [[8, 9]] },
			{ kind: "context", old: 12, new: 12, text: "let c = 4;" },
		],
	};

	test("writes the hunk header as git does, with its expand link", async () => {
		let html = await body(
			<Diff.Hunks
				path="a.ts"
				hunks={[change]}
				expandHref={(_, index) => `?expand=${index}`}
				labels={FILE_LABELS}
			/>,
		);
		expect(html).toContain("@@ -10,3 +10,3 @@ function total()");
		expect(html).toContain('href="?expand=0"');
	});

	test("anchors each side's number and marks the changed word", async () => {
		let html = await body(
			<Diff.Hunks path="a.ts" fileId="diff-a" hunks={[change]} labels={FILE_LABELS} />,
		);
		expect(html).toContain(
			'<a id="diff-aL11" href="#diff-aL11" data-line-number="11" tabindex="-1"></a>',
		);
		expect(html).toContain(
			'<a id="diff-aR11" href="#diff-aR11" data-line-number="11" tabindex="-1"></a>',
		);
		expect(html).toMatch(
			/<tr data-kind="del"><td><a id="diff-aL11"[^>]*><\/a><\/td><td><\/td><td>let b = <mark>2<\/mark>;<\/td><\/tr>/,
		);
	});

	test("pairs a deletion with its addition in one split row", async () => {
		let html = await body(
			<Diff.Hunks path="a.ts" fileId="diff-a" view="split" hunks={[change]} labels={FILE_LABELS} />,
		);
		expect(html).toMatch(
			/<tr data-old="del" data-new="add">.*id="diff-aL11".*<mark>2<\/mark>.*id="diff-aR11".*<mark>3<\/mark>/,
		);
		expect(occurrences(html, /<tr[ >]/g)).toBe(1 + 1 + 3);
	});

	test("draws a thread as a full-width row after its line", async () => {
		let html = await body(
			<Diff.Hunks
				path="a.ts"
				hunks={[change]}
				threads={{ R11: <p>Why 3?</p> }}
				labels={FILE_LABELS}
			/>,
		);
		expect(html).toMatch(
			/data-line-number="11" tabindex="-1"><\/a><\/td><td>let b = <mark>3<\/mark>;<\/td><\/tr><tr data-thread=""><td colspan="3"><p>Why 3\?<\/p>/,
		);
	});

	test("links each + to the app's comment form without script", async () => {
		let html = await body(
			<Diff.Hunks
				path="a.ts"
				hunks={[change]}
				commentHref={(path, side, line) => `/comment?path=${path}&line=${side}${line}`}
				labels={FILE_LABELS}
			/>,
		);
		expect(html).toContain(
			'href="/comment?path=a.ts&amp;line=L11" data-comment="L11" aria-label="Comment on line L11"',
		);
		expect(html).toContain('data-comment="R12"');
	});

	test("says why a binary, dropped or empty file has no lines", async () => {
		let props = { status: "modified", additions: 0, deletions: 0, labels: FILE_LABELS } as const;
		let binary = await body(<Diff.File path="logo.png" binary {...props} />);
		let dropped = await body(<Diff.File path="dist/app.js" tooLarge {...props} />);
		let renamed = await body(<Diff.File path="b.ts" oldPath="a.ts" {...props} status="renamed" />);

		expect(binary).toContain("Binary file not shown.");
		expect(dropped).toContain("Large diff not shown.");
		expect(renamed).toContain("a.ts → b.ts");
		expect(renamed).toContain("File renamed without changes.");
	});

	test("renders a viewed or collapsed file closed", async () => {
		let props = {
			status: "modified",
			additions: 1,
			deletions: 1,
			hunks: [change],
			labels: FILE_LABELS,
		} as const;
		expect(await body(<Diff.File path="a.ts" {...props} />)).toContain("<details open");
		expect(await body(<Diff.File path="a.ts" viewed {...props} />)).not.toContain("<details open");
		expect(await body(<Diff.File path="a.ts" collapsed {...props} />)).not.toContain(
			"<details open",
		);
	});
});
