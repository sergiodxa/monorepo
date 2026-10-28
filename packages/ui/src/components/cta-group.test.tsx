/**
 * Covers {@link CtaGroup} laying action children in a wrapping flex row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Button } from "./button.js";
import { CtaGroup } from "./cta-group.js";
import { LinkButton } from "./link-button.js";

describe("CtaGroup", () => {
	test("wraps primary and secondary actions in a flex cluster", async () => {
		let html = await renderToString(
			<CtaGroup>
				<Button size="lg" color="brand">
					Start
				</Button>
				<LinkButton href="/docs" size="lg" variant="outline">
					Docs
				</LinkButton>
			</CtaGroup>,
		);

		expect(html).toContain('data-slot="cta-group"');
		expect(html).toContain("Start");
		expect(html).toContain("Docs");
		expect(html).toContain('data-size="lg"');
		expect(html).toContain("flex-wrap: wrap");
	});
});
