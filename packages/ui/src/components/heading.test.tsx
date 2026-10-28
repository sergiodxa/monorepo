/**
 * Covers {@link Heading} default and marketing display size recipes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Heading } from "./heading.js";

describe("Heading", () => {
	test("keeps the default catalog size", async () => {
		let html = await renderToString(<Heading level={2}>Section</Heading>);

		expect(html).toContain("<h2");
		expect(html).toContain('data-size="default"');
		expect(html).toContain("font-weight: 600");
	});

	test("applies display and chapter marketing recipes", async () => {
		let display = await renderToString(<Heading size="display">Hero</Heading>);
		let chapter = await renderToString(
			<Heading size="chapter" level={2}>
				Chapter
			</Heading>,
		);

		expect(display).toContain('data-size="display"');
		expect(display).toContain("var(--ui-marketing-display-weight");
		expect(chapter).toContain('data-size="chapter"');
		expect(chapter).toContain("var(--ui-marketing-chapter-size");
	});
});
