/**
 * Lays a {@link CaseStudy} out in a real browser: the plate crossing the whole band edge to
 * edge past the measured column, the title and the three facts on the twelve-column grid at
 * 1440, and everything stacked without overflow at 375.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { CaseStudy } from "./case-study.js";

import "../reset.css";
import "../theme.css";

/** Mounts a populated case study in a host `width` pixels wide and returns the host. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<CaseStudy
			index="01"
			client="Harbour Line"
			meta="Transit · 2025"
			title="A ferry timetable you read from the pier"
			scene={
				<svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
					<rect width="1600" height="700" fill="gray" />
				</svg>
			}
			sceneLabel="The departures board on pier 3"
			plate="rgb(10 20 30)"
			problem="Riders missed connections they could not see coming."
			built="A live board and a rider app sharing one timetable service."
			result={{ value: "−31%", label: "missed connections, first winter" }}
		/>,
		{ container: host },
	);
	return host;
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let element = root.querySelector<T>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("CaseStudy", () => {
	test("runs the plate edge to edge across the band at 1440", () => {
		let host = mount(1440);
		let band = find(host, "section").getBoundingClientRect();
		let plate = find(host, '[data-slot="case-study-plate"]');
		let box = plate.getBoundingClientRect();

		expect(box.left).toBeCloseTo(band.left, 0);
		expect(box.width).toBeCloseTo(band.width, 0);
		expect(getComputedStyle(plate).backgroundColor).toBe("rgb(10, 20, 30)");
		expect(plate.getAttribute("role")).toBe("img");
		expect(plate.getAttribute("aria-label")).toBe("The departures board on pier 3");
	});

	test("sets the title and the three facts on one column line, side by side, at 1440", () => {
		let host = mount(1440);
		let title = find(host, "h2").getBoundingClientRect();
		let problem = find(host, '[data-slot="case-study-problem"]').getBoundingClientRect();
		let built = find(host, '[data-slot="case-study-built"]').getBoundingClientRect();
		let result = find(host, '[data-slot="case-study-result"]').getBoundingClientRect();
		let head = find(host, '[data-slot="case-study-head"]').getBoundingClientRect();

		expect(title.left).toBeGreaterThan(head.left + 100);
		expect(problem.left).toBeCloseTo(title.left, 0);
		expect(built.top).toBeCloseTo(problem.top, 0);
		expect(result.top).toBeCloseTo(problem.top, 0);
		expect(built.left).toBeGreaterThan(problem.right);
		expect(result.left).toBeGreaterThan(built.right);
		expect(built.width).toBeCloseTo(problem.width, 0);
	});

	test("stacks the facts and keeps the plate inside the band at 375", () => {
		let host = mount(375);
		let band = find(host, "section").getBoundingClientRect();
		let plate = find(host, '[data-slot="case-study-plate"]').getBoundingClientRect();
		let problem = find(host, '[data-slot="case-study-problem"]').getBoundingClientRect();
		let built = find(host, '[data-slot="case-study-built"]').getBoundingClientRect();

		expect(plate.width).toBeCloseTo(band.width, 0);
		expect(built.top).toBeGreaterThan(problem.bottom - 1);
		expect(host.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("labels the facts in English unless the page passes its own", () => {
		let host = mount(1440);
		let labels = [...host.querySelectorAll("dt")].map((dt) => dt.textContent);
		expect(labels).toEqual(["Problem", "What we built", "Result"]);
	});
});
