/**
 * Lays a {@link Curriculum} out in a real browser: parts side by side at 1280 and stacked at
 * 375 or under `layout="stack"`, lesson rows at least 44px tall whose number, title and meta
 * share a baseline while a long title wraps, and lessons that open and close on a summary click.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Curriculum } from "./curriculum.js";

import "../reset.css";
import "../theme.css";

/** A title long enough to wrap in a phone column. */
const LONG_TITLE = "Vertical rhythm, baseline grids and the measure of a comfortable line of text";

/** Mounts a three-part curriculum in a host `width` pixels wide and returns the host. */
function mount(width: number, layout?: Curriculum.Layout): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<Curriculum layout={layout} summary={<p data-testid="summary">12 chapters · 286 pages</p>}>
			<Curriculum.Part title="Foundations" meta="4 chapters · 86 pages">
				<Curriculum.Lesson number="01" title="Why type is code" meta="18 pages" badge="Free">
					<ul>
						<li>Glyphs, fonts and files</li>
					</ul>
				</Curriculum.Lesson>
				<Curriculum.Lesson number="02" title={LONG_TITLE} meta="112 pages">
					<p>Subtopics</p>
				</Curriculum.Lesson>
				<Curriculum.Lesson number="03" title="Static row" meta="9 pages" />
			</Curriculum.Part>
			<Curriculum.Part title="Systems" meta="4 chapters · 104 pages">
				<Curriculum.Lesson number="04" title="Scales" meta="22 pages" />
			</Curriculum.Part>
			<Curriculum.Part title="Shipping" meta="4 chapters · 96 pages">
				<Curriculum.Lesson number="08" title="Variable fonts" meta="20 pages" />
			</Curriculum.Part>
		</Curriculum>,
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

/** The first-line baseline of `element`, read from a zero-size inline-block probe. */
function baseline(element: HTMLElement): number {
	let probe = document.createElement("i");
	probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
	element.insertBefore(probe, element.firstChild);
	let bottom = probe.getBoundingClientRect().bottom;
	probe.remove();
	return bottom;
}

/** The tops of every part, rounded. */
function partTops(host: HTMLElement): number[] {
	return [...host.querySelectorAll('[data-slot="curriculum-part"]')].map((part) =>
		Math.round(part.getBoundingClientRect().top),
	);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("Curriculum", () => {
	test("puts parts side by side at 1280 under the summary", () => {
		let host = mount(1280);
		let tops = partTops(host);
		expect(new Set(tops).size).toBe(1);
		expect(find(host, '[data-testid="summary"]').getBoundingClientRect().bottom).toBeLessThan(
			tops[0]!,
		);
		expect(host.scrollWidth).toBeLessThanOrEqual(1280);
	});

	test("stacks parts at 1280 under layout stack, and at 375 by default", () => {
		for (let host of [mount(1280, "stack"), mount(375)]) {
			let tops = partTops(host);
			expect(tops[1]!).toBeGreaterThan(tops[0]!);
			expect(tops[2]!).toBeGreaterThan(tops[1]!);
		}
	});

	test.each([375, 1280])("aligns number, title and meta on one baseline at %ipx", (width) => {
		let host = mount(width);
		expect(host.scrollWidth).toBeLessThanOrEqual(width);

		for (let row of host.querySelectorAll<HTMLElement>('[data-slot="curriculum-lesson-row"]')) {
			let box = row.getBoundingClientRect();
			expect(box.height).toBeGreaterThanOrEqual(44);

			let number = find(row, '[data-slot="curriculum-lesson-number"]');
			let title = find(row, '[data-slot="curriculum-lesson-title"]');
			let meta = find(row, '[data-slot="curriculum-lesson-meta"]');
			let line = baseline(title);
			expect(Math.abs(baseline(number) - line)).toBeLessThanOrEqual(1);
			expect(Math.abs(baseline(meta) - line)).toBeLessThanOrEqual(1);
			expect(meta.getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 0.5);
			expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(
				meta.getBoundingClientRect().left,
			);
		}

		let numbers = [...host.querySelectorAll('[data-slot="curriculum-lesson-number"]')].map(
			(number) => Math.round(number.getBoundingClientRect().left),
		);
		let firstPart = numbers.slice(0, 3);
		expect(new Set(firstPart).size).toBe(1);
	});

	test("wraps a long title at 375 and keeps its meta in the row", () => {
		let host = mount(375);
		let row = host.querySelectorAll<HTMLElement>('[data-slot="curriculum-lesson-row"]')[1]!;
		let title = find(row, '[data-slot="curriculum-lesson-title"]');
		expect(title.getBoundingClientRect().height).toBeGreaterThan(30);
		expect(find(row, '[data-slot="curriculum-lesson-meta"]').textContent).toBe("112 pages");
	});

	test("opens and closes a lesson from its summary, turning the chevron", async () => {
		let host = mount(375);
		let details = find<HTMLDetailsElement>(host, "details");
		let summary = find(details, "summary");
		let body = find(details, '[data-slot="curriculum-lesson-body"]');
		let chevron = find(summary, '[data-slot="curriculum-lesson-chevron"] svg');

		expect(details.open).toBe(false);
		expect(body.checkVisibility()).toBe(false);

		summary.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		for (let animation of document.getAnimations()) animation.finish();
		expect(details.open).toBe(true);
		expect(body.checkVisibility()).toBe(true);
		expect(getComputedStyle(chevron).rotate).toBe("90deg");
		let bodyStart =
			body.getBoundingClientRect().left + parseFloat(getComputedStyle(body).paddingInlineStart);
		expect(bodyStart).toBeCloseTo(
			find(summary, '[data-slot="curriculum-lesson-title"]').getBoundingClientRect().left,
			0,
		);

		summary.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(details.open).toBe(false);
		expect(body.checkVisibility()).toBe(false);
	});

	test("renders a lesson without children as a static row with no chevron", () => {
		let host = mount(1280);
		let rows = host.querySelectorAll('[data-slot="curriculum-lesson"]');
		let staticRow = rows[2]!;
		expect(staticRow.querySelector("details")).toBeNull();
		expect(staticRow.querySelector('[data-slot="curriculum-lesson-chevron"] svg')).toBeNull();
		expect(find(rows[0]!, '[data-slot="curriculum-lesson-badge"]').textContent).toBe("Free");
	});
});
