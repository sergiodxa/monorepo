/**
 * Covers {@link AccentText}'s color, swash and highlight treatments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { AccentText } from "./accent-text.js";

describe("AccentText", () => {
	test("colors the phrase with the brand foreground by default", async () => {
		let html = await renderToString(<AccentText>faster</AccentText>);

		expect(html).toContain('data-variant="color"');
		expect(html).toContain("color: var(--ui-marketing-accent-color, var(--ui-brand-fg))");
		expect(html).not.toContain("<svg");
	});

	test("draws a hidden, stretched swash under a phrase that stays on one line", async () => {
		let html = await renderToString(<AccentText variant="swash">before</AccentText>);

		expect(html).toContain('data-variant="swash"');
		expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*preserveAspectRatio="none"/);
		expect(html).toContain("white-space: nowrap");
		expect(html).toContain("inset-block-start: 66%");
		expect(html).toContain("block-size: 0.58em");
		expect(html).toContain("fill: color-mix(in oklch, var(--ui-brand-bg-solid) 45%, transparent)");
		expect(html).toContain("before");
	});

	test("lays a cloned marker band behind the lower glyphs with highlight", async () => {
		let html = await renderToString(<AccentText variant="highlight">today</AccentText>);

		expect(html).toContain('data-variant="highlight"');
		expect(html).toContain("var(--ui-brand-bg-solid) 18%");
		expect(html).toContain("box-decoration-break: clone");
	});
});
