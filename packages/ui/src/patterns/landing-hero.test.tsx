/**
 * Covers {@link LandingHero} rendering title, CTAs, and media placement slots.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Button } from "../components/button.js";

import { LandingHero } from "./landing-hero.js";

describe("LandingHero", () => {
	test("renders display title, lead, actions, and end media", async () => {
		let html = await renderToString(
			<LandingHero
				mediaPlacement="end"
				title="Ship faster"
				description="Assemble landings from shared patterns."
				actions={<Button size="lg">Start</Button>}
				media={<img src="/shot.png" alt="Product" />}
			/>,
		);

		expect(html).toContain("Ship faster");
		expect(html).toContain("Assemble landings");
		expect(html).toContain("Start");
		expect(html).toContain('data-slot="landing-hero-media"');
		expect(html).toContain('data-slot="split"');
		expect(html).toContain('data-size="display"');
	});

	test("places media below the copy by default, with the note and proof under the actions", async () => {
		let html = await renderToString(
			<LandingHero
				title="Centered"
				align="center"
				note="No card required"
				proof={<span>Trusted</span>}
				media={<div>Shot</div>}
			/>,
		);

		expect(html).toContain('data-slot="landing-hero-note"');
		expect(html).toContain('data-slot="landing-hero-proof"');

		expect(html).toContain("Centered");
		expect(html).toContain("Shot");
		expect(html).not.toContain('data-slot="split"');
	});

	test("draws the eyebrow as a quiet pill, linked with an arrow when given an href", async () => {
		let html = await renderToString(
			<LandingHero eyebrow="Status pages are here" eyebrowHref="/blog/status" title="Title" />,
		);

		expect(html).toMatch(/<a[^>]*href="\/blog\/status"[^>]*data-variant="quiet"/);
		expect(html).toContain('data-slot="eyebrow-arrow"');
	});
});
