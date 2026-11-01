/**
 * Covers {@link LandingSection} tone, spacing, ruled hairline, and frame
 * chrome so the band host keeps the landing factory contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { LandingSection } from "./landing-section.js";

describe("LandingSection", () => {
	test("marks tone, spacing, and the named landing container", async () => {
		let html = await renderToString(
			<LandingSection tone="tinted" spacing="hero" id="proof">
				Content
			</LandingSection>,
		);

		expect(html).toContain('id="proof"');
		expect(html).toContain('data-tone="tinted"');
		expect(html).toContain('data-spacing="hero"');
		expect(html).toContain("container: ui-landing-section / inline-size");
		expect(html).toContain("var(--ui-landing-section-space-hero");
	});

	test("draws a hairline when ruled and frame rails when variant is frame", async () => {
		let html = await renderToString(
			<LandingSection ruled variant="frame">
				Framed
			</LandingSection>,
		);

		expect(html).toContain('data-variant="frame"');
		expect(html).toContain("border-block-start");
		expect(html).toContain("border-inline-start");
		expect(html).toContain("var(--ui-landing-section-space");
	});

	test("puts framed block padding on the rail column so rails run the full band height", async () => {
		let html = await renderToString(
			<LandingSection ruled variant="frame" spacing="hero">
				Framed
			</LandingSection>,
		);

		let spaceClass = html.match(
			/\.([a-z0-9-]+) \{\s*padding-block: round\(var\(--ui-landing-section-space-hero/,
		)?.[1];
		let sectionClasses = html.match(/<section[^>]*data-variant="frame"[^>]*class="([^"]*)"/)?.[1];

		expect(spaceClass).toBeTruthy();
		expect(sectionClasses).toBeTruthy();
		expect(sectionClasses).not.toContain(spaceClass!);
		expect(html).toMatch(new RegExp(`<div class="[^"]*${spaceClass}`));
		expect(html).toContain("border-inline-start");
		expect(html).toContain("padding-inline");
	});

	test("flush framed bands keep rails without section block padding", async () => {
		let html = await renderToString(
			<LandingSection ruled variant="frame" spacing="compact" flush>
				Strip
			</LandingSection>,
		);

		expect(html).toContain('data-flush="true"');
		expect(html).toContain("border-inline-start");
		expect(html).not.toContain("var(--ui-landing-section-space-compact");
	});
});
