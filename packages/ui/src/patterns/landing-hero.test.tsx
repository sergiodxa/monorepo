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

	test("places media below the copy when mediaPlacement is below", async () => {
		let html = await renderToString(
			<LandingHero
				title="Centered"
				align="center"
				mediaPlacement="below"
				media={<div>Shot</div>}
			/>,
		);

		expect(html).toContain("Centered");
		expect(html).toContain("Shot");
		expect(html).not.toContain('data-slot="split"');
	});
});
