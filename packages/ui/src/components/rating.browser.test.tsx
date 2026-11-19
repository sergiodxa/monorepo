/**
 * Holds the star rating to its contract in a real browser: the filled row covers the score's
 * share, the score is read as one sentence held to the scale, and the count follows the stars.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { Rating } from "./rating.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

/** The palette steps the stars paint with, which an app defines and a test stands in for. */
const PALETTE = {
	"--ui-color-warning-600": "rgb(217, 119, 6)",
	"--ui-color-neutral-600": "rgb(82, 82, 91)",
	"--ui-color-neutral-400": "rgb(161, 161, 170)",
};

let mounted: RenderResult | undefined;

beforeAll(() => {
	for (let [name, value] of Object.entries(PALETTE)) {
		document.documentElement.style.setProperty(name, value);
	}
});

afterAll(() => {
	for (let name of Object.keys(PALETTE)) document.documentElement.style.removeProperty(name);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("Rating", () => {
	test("fills the score's share of the stars and reads it as one sentence", () => {
		mounted = render(<Rating value={4.3} count={128} />);
		let stars = mounted.container.querySelector<HTMLElement>('[data-slot="rating-stars"]')!;
		let fill = mounted.container.querySelector<HTMLElement>('[data-slot="rating-fill"]')!;
		expect(stars.getAttribute("role")).toBe("img");
		expect(stars.getAttribute("aria-label")).toBe("4.3 out of 5 stars");
		expect(stars.querySelectorAll(":scope > svg")).toHaveLength(5);
		let share = fill.getBoundingClientRect().width / stars.getBoundingClientRect().width;
		expect(share).toBeCloseTo(0.86, 2);
		expect(getComputedStyle(fill).color).not.toBe(getComputedStyle(stars).color);
		expect(mounted.container.querySelector('[data-slot="rating-count"]')!.textContent).toBe(
			"(128)",
		);
	});

	test("holds a score to the scale, names it in the caller's words and takes a count label", () => {
		mounted = render(
			<Rating value={7} max={4} size="sm" label="Rated {value} of {max}" countLabel="12 reviews" />,
		);
		let fill = mounted.container.querySelector<HTMLElement>('[data-slot="rating-fill"]')!;
		let stars = mounted.container.querySelector<HTMLElement>('[data-slot="rating-stars"]')!;
		expect(stars.getAttribute("aria-label")).toBe("Rated 4 of 4");
		expect(fill.getBoundingClientRect().width).toBeCloseTo(stars.getBoundingClientRect().width, 0);
		expect(mounted.container.textContent).toBe("12 reviews");
	});

	test("leaves the count out when none is given", () => {
		mounted = render(<Rating value={0} />);
		expect(mounted.container.querySelector('[data-slot="rating-count"]')).toBeNull();
		expect(
			mounted.container
				.querySelector<HTMLElement>('[data-slot="rating-fill"]')!
				.getBoundingClientRect().width,
		).toBe(0);
	});
});
