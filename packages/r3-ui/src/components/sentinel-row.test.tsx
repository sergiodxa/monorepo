/**
 * Tests for {@link SentinelRow}: covers its base centered/muted styling,
 * merging a consumer-supplied `mix` alongside that styling, and forwarding
 * every other prop through to the rendered host `<div>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { css } from "remix/ui";
import { renderToString } from "remix/ui/server";

import { SentinelRow } from "./sentinel-row";

describe(SentinelRow.name, () => {
	test("renders a div holding its children", async () => {
		let html = await renderToString(<SentinelRow>Loading more…</SentinelRow>);

		expect(html).toContain("<div");
		expect(html).toContain("Loading more…");
	});

	test("applies its centered, muted sentinel styling", async () => {
		let html = await renderToString(<SentinelRow>Loading more…</SentinelRow>);

		expect(html).toContain("display: flex;");
		expect(html).toContain("justify-content: center;");
		expect(html).toContain("color: var(--ui-neutral-fg-muted);");
	});

	test("merges a consumer-supplied mix alongside its own styling", async () => {
		let html = await renderToString(
			<SentinelRow mix={css({ color: "red" })}>Loading more…</SentinelRow>,
		);

		expect(html).toContain("color: red;");
		// Two distinct generated classes land on the same host: the sentinel
		// row's own styling and the consumer's extra mix, neither replacing
		// the other.
		expect(html.match(/class="[^"]*\s[^"]*"/)).not.toBeNull();
	});

	test("forwards arbitrary host props through to the rendered div", async () => {
		let html = await renderToString(
			<SentinelRow id="loading-row" aria-live="polite">
				Loading more…
			</SentinelRow>,
		);

		expect(html).toContain('id="loading-row"');
		expect(html).toContain('aria-live="polite"');
	});
});
