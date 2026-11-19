/**
 * Renders `RatingBreakdown` in a real browser: the score reads "out of 5", every bar is a
 * meter named by its label and valued by its figure, fills in proportion to its value, and
 * the category bars run two to a row only once the summary itself is wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { RatingBreakdown } from "./rating-breakdown.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

/** Share of reviews at each star level, five stars first. */
const SHARES = [0.8, 0.12, 0.04, 0.02, 0.02];

/** Per-category scores out of five. */
const CATEGORIES: Array<[string, number]> = [
	["Cleanliness", 4.9],
	["Accuracy", 4.8],
	["Location", 4.5],
	["Value", 4.2],
];

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a summary `width` pixels wide and returns its section. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<RatingBreakdown score={4.86} count="128 reviews">
			<RatingBreakdown.Group kind="stars" aria-label="Ratings by star">
				{SHARES.map((share, index) => (
					<RatingBreakdown.Bar
						label={`${5 - index} stars`}
						value={share}
						display={`${Math.round(share * 100)}%`}
					/>
				))}
			</RatingBreakdown.Group>
			<RatingBreakdown.Group kind="categories" aria-label="Ratings by category">
				{CATEGORIES.map(([label, score]) => (
					<RatingBreakdown.Bar label={label} value={score} display={score.toFixed(1)} />
				))}
			</RatingBreakdown.Group>
		</RatingBreakdown>,
		{ container: host },
	);
	return host.querySelector("section")!;
}

/** The accessible name a meter's `aria-labelledby` resolves to. */
function nameOf(meter: Element): string | null | undefined {
	return document.getElementById(meter.getAttribute("aria-labelledby") ?? "")?.textContent;
}

describe("RatingBreakdown", () => {
	test("reads the score out of its maximum beside the review count", () => {
		let section = mount(600);
		let score = section.querySelector("[data-slot=rating-breakdown-score]")!;
		expect(score.textContent).toBe("4.86 out of 5128 reviews");
		expect(score.querySelector("svg")?.closest("[aria-hidden=true]")).not.toBeNull();
	});

	test("names every bar as a meter with its label and value", () => {
		let section = mount(600);
		let meters = [...section.querySelectorAll("[role=meter]")];
		expect(meters.map(nameOf)).toEqual([
			"5 stars",
			"4 stars",
			"3 stars",
			"2 stars",
			"1 stars",
			"Cleanliness",
			"Accuracy",
			"Location",
			"Value",
		]);
		expect(meters[0]?.getAttribute("aria-valuetext")).toBe("80%");
		expect(meters[0]?.getAttribute("aria-valuemax")).toBe("1");
		expect(meters[5]?.getAttribute("aria-valuenow")).toBe("4.9");
		expect(meters[5]?.getAttribute("aria-valuemax")).toBe("5");
	});

	test("fills each bar in proportion to its value", () => {
		let section = mount(600);
		for (let meter of section.querySelectorAll("[role=meter]")) {
			let track = meter.getBoundingClientRect().width;
			let fill = meter.firstElementChild!.getBoundingClientRect().width;
			let share =
				Number(meter.getAttribute("aria-valuenow")) / Number(meter.getAttribute("aria-valuemax"));
			expect(fill / track).toBeCloseTo(share, 2);
		}
	});

	test("runs categories two to a row only when the summary is wide", () => {
		let columns = (section: HTMLElement) =>
			new Set(
				[...section.querySelectorAll("[data-kind=categories] > li")].map((item) =>
					Math.round(item.getBoundingClientRect().left),
				),
			).size;
		expect(columns(mount(640))).toBe(2);
		document.body.replaceChildren();
		expect(columns(mount(320))).toBe(1);
	});
});
