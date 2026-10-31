/**
 * Covers what a content file writes reaching the shared docs blocks: a fence's title and
 * marked lines, an alert's kind and label, and a `files` layout's folders and files. Each
 * is read off the parsed markdown, so these render a document to check the mapping held.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { renderToStream } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { readContent } from "~/app/services/content";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";

/** Renders one content file through the map every guide renders through. */
async function render(source: string): Promise<string> {
	let content = readContent(source);
	if (isFailure(content)) throw content.error;
	let html = await new Response(
		renderToStream(toRemix(content.data, { components: DOCS_COMPONENTS })),
	).text();
	return html.replace(/<style[^]*?<\/style>/g, "");
}

describe("a fence", () => {
	test("names its file in the header and marks the lines its annotation lists", async () => {
		let html = await render(
			['```ts {% title="app/routes.ts" highlight={[2]} %}', "let a = 1;", "let b = 2;", "```"].join(
				"\n",
			),
		);

		expect(html).toContain('data-slot="code-block"');
		expect(html).toContain("app/routes.ts");
		expect(html.match(/data-mark="highlight"/g)).toHaveLength(1);
	});

	test("titles an untitled shell fence Terminal", async () => {
		let html = await render(["```bash", "npm add remix", "```"].join("\n"));

		expect(html).toContain("Terminal");
	});

	test("drops a malformed line list instead of failing the page", async () => {
		let html = await render(['```ts {% highlight="two" %}', "let a = 1;", "```"].join("\n"));

		expect(html).toContain('data-slot="code-block"');
		expect(html).not.toContain("data-mark");
	});
});

describe("an alert", () => {
	test("draws a caution as a danger callout that keeps its own label", async () => {
		let html = await render("> [!CAUTION]\n> Rotate the key first.");

		expect(html).toContain('data-kind="danger"');
		expect(html).toContain('aria-label="Caution"');
	});

	test("draws an important alert as a note labelled Important", async () => {
		let html = await render("> [!IMPORTANT]\n> Read this.");

		expect(html).toContain('data-kind="note"');
		expect(html).toContain('aria-label="Important"');
	});
});

describe("a files layout", () => {
	test("draws its folders and files as one tree", async () => {
		let html = await render(
			[
				'<files title="links">',
				'<folder name="bootstrap">',
				'<file name="worker.ts" />',
				"</folder>",
				'<folder name="database" />',
				"</files>",
			].join("\n"),
		);

		expect(html).toContain('data-slot="file-tree"');
		expect(html.match(/data-slot="file-tree-directory"/g)).toHaveLength(2);
		expect(html.match(/data-slot="file-tree-file"/g)).toHaveLength(1);
		expect(html).toContain("worker.ts");
	});
});
