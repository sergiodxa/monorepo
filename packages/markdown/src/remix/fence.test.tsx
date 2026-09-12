/**
 * Checks the markup a code block turns into: one span per painted run, the raw
 * source where nothing painted it, and the header that appears only for the file
 * path and title an annotation wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/* @jsxImportSource remix/ui */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { Fence } from "./fence.js";

/** Painted runs, spelled out here so the assertions stand on the token shape alone. */
const TOKENS: Fence.Token[] = [
	{ type: "keyword", value: "let" },
	{ type: "plain", value: " a = " },
	{ type: "number", value: "1" },
];

/** Renders the component the way a document does and returns the markup for inspection. */
function render(props: Fence.Props): Promise<string> {
	return renderToString(
		<Fence
			tokens={props.tokens}
			content={props.content}
			language={props.language}
			path={props.path}
			title={props.title}
		/>,
	);
}

/** A painted code block, which every case varies one field of. */
function props(overrides: Partial<Fence.Props> = {}): Fence.Props {
	return { tokens: [], content: "let a = 1", language: "ts", ...overrides };
}

describe("Fence", () => {
	test("draws one span per painted run, naming the run's type as its class", async () => {
		let html = await render(props({ tokens: TOKENS }));

		expect(html).toContain('class="token keyword"');
		expect(html).toContain('class="token number"');
		expect(html).toContain("let");
		expect(html).toContain("1");
	});

	test("draws a plain run as the bare text it is", async () => {
		let html = await render(props({ tokens: TOKENS }));

		expect(html).not.toContain('class="token plain"');
		expect(html).toContain("a = ");
	});

	test("draws the raw source where nothing painted the block", async () => {
		let html = await render(props({ tokens: [], content: "let a = 1" }));

		expect(html).toContain("let a = 1");
		expect(html).not.toContain("token");
	});

	test("puts the language on the pre and on the code alike", async () => {
		let html = await render(props({ language: "tsx" }));

		expect(html.match(/language-tsx/g)).toHaveLength(2);
		expect(html).toContain("<pre");
		expect(html).toContain("<code");
	});

	test("draws no header for a block that names neither a path nor a title", async () => {
		let html = await render(props());

		expect(html).not.toContain("<header");
	});

	test("draws a header for a block that names only a title", async () => {
		let html = await render(props({ title: "Entry point" }));

		expect(html).toContain("<header");
		expect(html).toContain("Entry point");
	});

	test("draws a header for a block that names only a path", async () => {
		let html = await render(props({ path: "src/index.ts" }));

		expect(html).toContain("<header");
		expect(html).toContain("src/index.ts");
	});

	test("draws both in one header where a block names a path and a title", async () => {
		let html = await render(props({ path: "src/index.ts", title: "Entry point" }));

		expect(html.match(/<header/g)).toHaveLength(1);
		expect(html).toContain("src/index.ts");
		expect(html).toContain("Entry point");
		expect(html.indexOf("Entry point")).toBeLessThan(html.indexOf("src/index.ts"));
	});
});
