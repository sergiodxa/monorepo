/**
 * Renders `RangeMonths` in a page that matches `(pointer: coarse)` throughout: every day grows to
 * the 44px a fingertip needs, and a single month still fits a 320px phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { RangeMonths } from "./range-months.js";

import "../reset.css";
import "../theme.css";

/** The words read to assistive technology. */
const LABELS: RangeMonths.Labels = {
	previous: "Previous month",
	next: "Next month",
	start: "check-in",
	end: "check-out",
};

afterEach(() => {
	document.body.replaceChildren();
});

describe("RangeMonths on a touch screen", () => {
	test("gives every day a 44px target and still fits a 320px phone", () => {
		let host = document.createElement("div");
		host.style.width = "320px";
		document.body.appendChild(host);
		render(
			<RangeMonths
				label="Stay dates"
				labels={LABELS}
				locale="en-US"
				month="2026-03"
				months={1}
				href={(next) => `?${next.month}`}
			/>,
			{ container: host },
		);
		let root = host.querySelector<HTMLElement>("[data-slot=range-months]")!;
		let day = root.querySelector('a[data-date="2026-03-10"]')!.getBoundingClientRect();
		expect(day.width).toBeGreaterThanOrEqual(44);
		expect(day.height).toBeGreaterThanOrEqual(44);
		expect(root.scrollWidth).toBeLessThanOrEqual(320);
	});
});
