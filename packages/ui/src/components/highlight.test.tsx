/**
 * Tests for the markup and tint {@link Highlight} renders: matches become `<mark>`, every
 * stretch stays escaped text, and the tint follows the color role.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Highlight } from "./highlight.js";

describe(Highlight.name, () => {
	test("marks exactly the matched stretches, in order", async () => {
		let html = await renderToString(
			<Highlight
				segments={[
					{ text: "Learn ", match: false },
					{ text: "Remix", match: true },
					{ text: " today", match: false },
				]}
			/>,
		);

		expect(html).toMatch(/<span data-color="brand"[^>]*>Learn <mark>Remix<\/mark> today<\/span>/);
	});

	test("escapes the text of every stretch", async () => {
		let html = await renderToString(
			<Highlight
				segments={[
					{ text: "<b>", match: true },
					{ text: " & co", match: false },
				]}
			/>,
		);

		expect(html).toContain("<mark>&lt;b&gt;</mark> &amp; co");
	});

	test("tints the marks with the color role asked for", async () => {
		let html = await renderToString(
			<Highlight color="warning" segments={[{ text: "hit", match: true }]} />,
		);

		expect(html).toContain('data-color="warning"');
		expect(html).toContain("--ui-warning-bg-tint");
	});
});
