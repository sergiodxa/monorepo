/**
 * Covers {@link MarketingHeader} eyebrow variants, chapter title sizing, and
 * centered alignment so section openers keep the marketing type contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { MarketingHeader } from "./marketing-header.js";

describe("MarketingHeader", () => {
	test("renders a chapter title and optional lead", async () => {
		let html = await renderToString(
			<MarketingHeader description="Support copy for the claim.">
				Ship with shared measure
			</MarketingHeader>,
		);

		expect(html).toContain("Ship with shared measure");
		expect(html).toContain("Support copy for the claim.");
		expect(html).toContain('data-size="chapter"');
		expect(html).toContain("var(--ui-marketing-chapter-size");
		expect(html).toContain("var(--ui-marketing-lead-size");
	});

	test("applies eyebrow variants through data-variant", async () => {
		let pill = await renderToString(
			<MarketingHeader eyebrow="New" eyebrowVariant="pill">
				Title
			</MarketingHeader>,
		);
		let mono = await renderToString(
			<MarketingHeader eyebrow="Section" eyebrowVariant="mono">
				Title
			</MarketingHeader>,
		);
		let numbered = await renderToString(
			<MarketingHeader eyebrow="Features" eyebrowVariant="numbered" eyebrowIndex="01">
				Title
			</MarketingHeader>,
		);
		let fallback = await renderToString(<MarketingHeader eyebrow="Section">Title</MarketingHeader>);

		expect(pill).toContain('data-variant="pill"');
		expect(mono).toContain('data-variant="mono"');
		expect(numbered).toContain('data-variant="numbered"');
		expect(numbered).toContain('data-slot="eyebrow-index"');
		expect(fallback).toContain('data-variant="mono"');
		expect(mono).toContain("text-transform: uppercase");
	});

	test("centers the stack when align is center", async () => {
		let html = await renderToString(
			<MarketingHeader align="center" description="Lead">
				Centered
			</MarketingHeader>,
		);

		expect(html).toContain('data-align="center"');
		expect(html).toContain("text-align: center");
	});
});
