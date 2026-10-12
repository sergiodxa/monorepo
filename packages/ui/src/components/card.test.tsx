/**
 * Covers the card panel's ring-shadow edge and its text wrapping, read from
 * the stylesheet the component emits: a neutral card hands its edge to the
 * ring shadow, and the title balances while body copy wraps prettily.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Card } from "./card.js";

describe("Card", () => {
	test("draws its edge with the theme's ring shadow and clears a neutral card's border", async () => {
		let html = await renderToString(<Card>Plan</Card>);

		expect(html).toContain("--ui-box-shadow-ring: var(--ui-shadow-ring,");
		expect(html.replace(/\s+/g, " ")).toMatch(
			/&\[data-color="neutral"\] \{ border-color: transparent; \}/,
		);
	});

	test("balances the title and wraps description and content prettily", async () => {
		let html = await renderToString(
			<Card>
				<Card.Header>
					<Card.Title>Pro plan</Card.Title>
					<Card.Description>For growing teams.</Card.Description>
				</Card.Header>
				<Card.Content>Everything in Free, and more.</Card.Content>
			</Card>,
		);

		expect(html).toContain("text-wrap: balance");
		expect(html).toContain("text-wrap: pretty");
	});
});
