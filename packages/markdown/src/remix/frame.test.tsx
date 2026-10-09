/**
 * Checks that a parsed `frame` tag reaches the server renderer as a Remix frame, with
 * its children as the streamed fallback, since that is the contract a page relies on
 * to hold dynamic regions inside otherwise static prose.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/* @jsxImportSource remix/component */

import { renderToStream } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Markdown } from "../index.js";
import { FRAME_TAG } from "../plugin/frames.js";

import { FrameTag, toRemix } from "./index.js";

const OPTIONS = { tags: { frame: FRAME_TAG } } satisfies Markdown.Options;

/** Parses and renders a document, resolving every frame through `resolveFrame`. */
async function render(
	source: string,
	resolveFrame: (src: string, target?: string) => string,
): Promise<string> {
	let result = Markdown.parse(source, OPTIONS);
	if (result.status === "failure") throw result.error;
	let node = toRemix(result.data.document, { components: { frame: FrameTag } });
	return await new Response(renderToStream(node, { resolveFrame })).text();
}

describe("FrameTag", () => {
	test("renders the frame's content where the tag sits in the prose", async () => {
		let requested: string[] = [];
		let html = await render('Before.\n\n<frame src="/frames/demo" />\n\nAfter.', (src) => {
			requested.push(src);
			return "<p>From the server</p>";
		});

		expect(requested).toEqual(["/frames/demo"]);
		expect(html).toContain("From the server");
		expect(html.indexOf("Before.")).toBeLessThan(html.indexOf("From the server"));
		expect(html.indexOf("From the server")).toBeLessThan(html.indexOf("After."));
	});

	test("passes the tag's name as the frame's target", async () => {
		let targets: (string | undefined)[] = [];
		await render('<frame src="/frames/demo" name="demo" />', (_src, target) => {
			targets.push(target);
			return "<p>Named</p>";
		});

		expect(targets).toEqual(["demo"]);
	});

	test("renders the tag's children as the fallback", async () => {
		let html = await render('<frame src="/frames/demo">\nLoading the **demo**\n</frame>', () => "");

		expect(html).toContain("Loading the <strong>demo</strong>");
	});
});
