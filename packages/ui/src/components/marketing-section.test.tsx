/**
 * Covers {@link MarketingSection} tone, spacing, ruled hairline, and frame
 * chrome so the band host keeps the marketing factory contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { MarketingSection } from "./marketing-section.js";

describe("MarketingSection", () => {
	test("marks tone, spacing, and the named marketing container", async () => {
		let html = await renderToString(
			<MarketingSection tone="tinted" spacing="hero" id="proof">
				Content
			</MarketingSection>,
		);

		expect(html).toContain('id="proof"');
		expect(html).toContain('data-tone="tinted"');
		expect(html).toContain('data-spacing="hero"');
		expect(html).toContain("container: ui-marketing-section / inline-size");
		expect(html).toContain("var(--ui-marketing-section-space-hero");
	});

	test("draws a hairline when ruled and frame rails when variant is frame", async () => {
		let html = await renderToString(
			<MarketingSection ruled variant="frame">
				Framed
			</MarketingSection>,
		);

		expect(html).toContain('data-variant="frame"');
		expect(html).toContain("border-block-start");
		expect(html).toContain("border-inline-start");
	});
});
