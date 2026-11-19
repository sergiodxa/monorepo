/**
 * Holds the order summary to its contract in a real browser: on a phone it folds behind a
 * row showing the total, from 56rem it stays open with no fold row, and a summary that does
 * not fold is a plain labelled section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { CartLine } from "./cart-line.js";
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

/** A summary of one line, folding on phones. */
function Summary() {
	return () => (
		<OrderSummary
			collapsible
			lines={
				<ul>
					<CartLine name="Tidepool print" price="€48.00" />
				</ul>
			}
			breakdown={<p>Total €52.95</p>}
			total="€52.95"
			labels={{ show: "Show order summary", heading: "Order summary" }}
		/>
	);
}

/** Whether an element is rendered, which content a closed disclosure hides is not. */
function shown(element: Element): boolean {
	return element.checkVisibility({ contentVisibilityAuto: true });
}

describe("OrderSummary", () => {
	test("folds behind a row with the total on a phone and unfolds on a press", async () => {
		await page.viewport(375, 800);
		mounted = render(<Summary />);
		let details = mounted.container.querySelector("details")!;
		let toggle = details.querySelector<HTMLElement>("summary")!;
		let body = details.querySelector('[data-slot="order-summary-body"]')!;
		expect(toggle.textContent).toBe("Show order summary€52.95");
		expect(shown(toggle)).toBe(true);
		expect(shown(body)).toBe(false);
		await userEvent.click(toggle);
		expect(details.open).toBe(true);
		expect(shown(body)).toBe(true);
	});

	test("stays open with no fold row from 56rem", async () => {
		await page.viewport(1200, 800);
		mounted = render(<Summary />);
		let details = mounted.container.querySelector("details")!;
		expect(details.open).toBe(false);
		expect(shown(details.querySelector("summary")!)).toBe(false);
		expect(shown(details.querySelector('[data-slot="order-summary-body"]')!)).toBe(true);
	});

	test("renders a plain labelled section when it does not fold", async () => {
		mounted = render(
			<OrderSummary
				lines={<ul />}
				breakdown="Total €0"
				total="€0"
				labels={{ show: "Show order summary", heading: "Order summary" }}
			/>,
		);
		let section = mounted.container.querySelector("section")!;
		expect(section.getAttribute("aria-label")).toBe("Order summary");
		expect(section.querySelector("summary")).toBeNull();
	});
});
