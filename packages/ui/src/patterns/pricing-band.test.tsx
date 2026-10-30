/**
 * Covers {@link PricingBand} markup: plan cards, the featured flag, the price and period,
 * the checked feature list, and the plan headings one level under the band title.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { CheckRow } from "./check-row.js";
import { PricingBand } from "./pricing-band.js";

describe("PricingBand", () => {
	test("renders every plan with its price, period, features and action", async () => {
		let html = await renderToString(
			<PricingBand title="Pricing" columns={2}>
				<PricingBand.Plan
					name="Hobby"
					price="$0"
					description="For side projects"
					features={<CheckRow>Five monitors</CheckRow>}
					action={<a href="/signup">Start free</a>}
				/>
				<PricingBand.Plan
					name="Team"
					price="$29"
					period="/month"
					featured
					badge={<span>Most popular</span>}
					action={<a href="/signup?plan=team">Start trial</a>}
				/>
			</PricingBand>,
		);

		expect(html).toContain('data-columns="2"');
		expect(html.match(/data-slot="pricing-plan"/g)).toHaveLength(2);
		expect(html).toContain("/month");
		expect(html).toContain("Most popular");
		expect(html).toContain('data-slot="check-list"');
		expect(html).toContain("Five monitors");
		expect(html).toContain('href="/signup?plan=team"');
		expect(html).toMatch(/<h1[^>]*>Pricing<\/h1>/);
		expect(html).toMatch(/<h2[^>]*data-slot="pricing-plan-name"[^>]*>Hobby<\/h2>/);
	});

	test("marks only the featured plan", async () => {
		let html = await renderToString(
			<PricingBand title="Pricing">
				<PricingBand.Plan name="Hobby" price="$0" action={<a href="/a">A</a>} />
				<PricingBand.Plan name="Team" price="$29" featured action={<a href="/b">B</a>} />
			</PricingBand>,
		);

		expect(html.match(/data-featured="true"/g)).toHaveLength(1);
		expect(html).toMatch(/data-featured="true"[^>]*>[\s\S]*?Team/);
		expect(html).toContain("@container ui-marketing-pricing (min-width:");
	});

	test("omits the feature list and period when the plan has none", async () => {
		let html = await renderToString(
			<PricingBand title="Pricing">
				<PricingBand.Plan name="Enterprise" price="Custom" action={<a href="/sales">Talk</a>} />
			</PricingBand>,
		);

		expect(html).not.toContain('data-slot="check-list"');
		expect(html).not.toContain("data-featured");
	});
});
