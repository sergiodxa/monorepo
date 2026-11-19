/**
 * Holds the checkout frame to its contract in a real browser: on a phone the summary leads,
 * then the steps, then the form; from 56rem the summary sits in a sticky 24rem column beside
 * the form, inside a frame no wider than 70rem.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { CheckoutLayout } from "./checkout-layout.js";
import { OrderSummary } from "./order-summary.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

afterAll(async () => {
	await page.viewport(1280, 900);
});

/** A checkout with each region marked. */
function Checkout() {
	return () => (
		<CheckoutLayout
			steps={<p data-region="steps">Steps</p>}
			summary={
				<OrderSummary
					collapsible
					lines={<ul />}
					breakdown={<p>Total €52.95</p>}
					total="€52.95"
					labels={{ show: "Show order summary", heading: "Order summary" }}
				/>
			}
		>
			<form data-region="main">Form</form>
		</CheckoutLayout>
	);
}

describe("CheckoutLayout", () => {
	test("stacks the summary, then the steps, then the form on a phone", async () => {
		await page.viewport(375, 800);
		mounted = render(<Checkout />);
		let summary = mounted.container.querySelector('[data-slot="checkout-layout-summary"]')!;
		let steps = mounted.container.querySelector('[data-region="steps"]')!;
		let main = mounted.container.querySelector('[data-region="main"]')!;
		expect(summary.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			steps.getBoundingClientRect().top,
		);
		expect(steps.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			main.getBoundingClientRect().top,
		);
	});

	test("puts the summary in a sticky 24rem column beside the form from 56rem", async () => {
		await page.viewport(1200, 800);
		mounted = render(<Checkout />);
		let layout = mounted.container.querySelector<HTMLElement>('[data-slot="checkout-layout"]')!;
		let summary = mounted.container.querySelector<HTMLElement>(
			'[data-slot="checkout-layout-summary"]',
		)!;
		let main = mounted.container.querySelector('[data-region="main"]')!;
		expect(summary.getBoundingClientRect().width).toBe(24 * 16);
		expect(summary.getBoundingClientRect().left).toBeGreaterThan(
			main.getBoundingClientRect().right,
		);
		expect(getComputedStyle(summary).position).toBe("sticky");
		expect(layout.getBoundingClientRect().width).toBeLessThanOrEqual(70 * 16);
	});
});
