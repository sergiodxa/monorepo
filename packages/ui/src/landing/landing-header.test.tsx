/**
 * Covers {@link LandingHeader} eyebrow variants, chapter title sizing, and
 * centered alignment so section openers keep the landing type contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { LandingHeader } from "./landing-header.js";

describe("LandingHeader", () => {
	test("renders a chapter title and optional lead", async () => {
		let html = await renderToString(
			<LandingHeader description="Support copy for the claim.">
				Ship with shared measure
			</LandingHeader>,
		);

		expect(html).toContain("Ship with shared measure");
		expect(html).toContain("Support copy for the claim.");
		expect(html).toContain('data-size="chapter"');
		expect(html).toContain("var(--ui-landing-chapter-size");
		expect(html).toContain("var(--ui-landing-lead-size");
	});

	test("applies eyebrow variants through data-variant", async () => {
		let pill = await renderToString(
			<LandingHeader eyebrow="New" eyebrowVariant="pill">
				Title
			</LandingHeader>,
		);
		let mono = await renderToString(
			<LandingHeader eyebrow="Section" eyebrowVariant="mono">
				Title
			</LandingHeader>,
		);
		let numbered = await renderToString(
			<LandingHeader eyebrow="Features" eyebrowVariant="numbered" eyebrowIndex="01">
				Title
			</LandingHeader>,
		);
		let fallback = await renderToString(<LandingHeader eyebrow="Section">Title</LandingHeader>);

		expect(pill).toContain('data-variant="pill"');
		expect(mono).toContain('data-variant="mono"');
		expect(numbered).toContain('data-variant="numbered"');
		expect(numbered).toContain('data-slot="eyebrow-index"');
		expect(fallback).toContain('data-variant="mono"');
		expect(mono).toContain("text-transform: var(--ui-landing-eyebrow-transform, uppercase)");
	});

	test("centers the stack when align is center", async () => {
		let html = await renderToString(
			<LandingHeader align="center" description="Lead">
				Centered
			</LandingHeader>,
		);

		expect(html).toContain('data-align="center"');
		expect(html).toContain("text-align: center");
	});
});
