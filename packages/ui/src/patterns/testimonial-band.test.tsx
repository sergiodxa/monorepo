/**
 * Covers {@link TestimonialBand} markup: each quote is a figure pairing a blockquote with a
 * figcaption, and the masonry host carries the requested column count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { TestimonialBand } from "./testimonial-band.js";

describe("TestimonialBand", () => {
	test("renders each quote as a figure with a blockquote and a figcaption", async () => {
		let html = await renderToString(
			<TestimonialBand title="Loved by on-call teams" columns={2}>
				<TestimonialBand.Quote name="Ana Ruiz" jobTitle="SRE, Lumen" avatar="AR">
					We caught the outage <strong>before our customers did</strong>.
				</TestimonialBand.Quote>
				<TestimonialBand.Quote name="Tom Hale">Setup took five minutes.</TestimonialBand.Quote>
			</TestimonialBand>,
		);

		expect(html).toContain('data-columns="2"');
		expect(html.match(/<figure\b/g)).toHaveLength(2);
		expect(html.match(/<blockquote\b/g)).toHaveLength(2);
		expect(html).toMatch(/<figcaption\b[^>]*>[\s\S]*?Ana Ruiz[\s\S]*?SRE, Lumen/);
		expect(html).toContain("<strong>before our customers did</strong>");
		expect(html).toContain("break-inside: avoid");
		expect(html).toContain("@container ui-marketing-testimonials (min-width:");
	});

	test("renders the avatar frame only when an avatar is given", async () => {
		let html = await renderToString(
			<TestimonialBand title="Quotes">
				<TestimonialBand.Quote name="Ana Ruiz" avatar="AR">
					Quote
				</TestimonialBand.Quote>
				<TestimonialBand.Quote name="Tom Hale">Quote</TestimonialBand.Quote>
			</TestimonialBand>,
		);

		expect(html.match(/data-slot="testimonial-avatar"/g)).toHaveLength(1);
		expect(html).toContain('data-columns="3"');
	});
});
