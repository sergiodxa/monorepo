/**
 * Covers {@link ClosingCta} inverse band with title and actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Button } from "../components/button.js";

import { ClosingCta } from "./closing-cta.js";

describe("ClosingCta", () => {
	test("renders inverse tone with title and CTA cluster", async () => {
		let html = await renderToString(
			<ClosingCta
				title="Built for the future"
				description="Start in minutes."
				actions={<Button size="lg">Get started</Button>}
			/>,
		);

		expect(html).toContain("Built for the future");
		expect(html).toContain("Start in minutes.");
		expect(html).toContain("Get started");
		expect(html).toContain('data-tone="inverse"');
		expect(html).toContain('data-slot="cta-group"');
	});
});
