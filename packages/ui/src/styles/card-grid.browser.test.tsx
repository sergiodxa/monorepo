/**
 * Lays every marketing grid out in a real browser for 2–9 items at phone, tablet and
 * desktop widths, and checks that no layout leaves a short last row hanging under the
 * first columns: the last row either fills the width or sits centred.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Feature } from "../components/feature.js";
import { LogoCloud } from "../components/logo-cloud.js";
import { StatStrip } from "../components/stat-strip.js";
import { Bento } from "../patterns/bento.js";
import { PricingBand } from "../patterns/pricing-band.js";
import { StepList } from "../patterns/step-list.js";
import { TestimonialBand } from "../patterns/testimonial-band.js";

/** Item counts every grid is checked with. */
const COUNTS = [2, 3, 4, 5, 6, 7, 8, 9];

/** Host widths covering the phone, `md`, `lg` and wide container steps. */
const WIDTHS = [340, 640, 900, 1200];

/** Mounts a node in a column of the given width attached to the document. */
function mount(width: number, node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** The given number of indexes, for mapping into children. */
function range(count: number): number[] {
	return Array.from({ length: count }, (_, index) => index);
}

/** Groups boxes into rows by their top edge. */
function rows(boxes: DOMRect[]): DOMRect[][] {
	let byTop = new Map<number, DOMRect[]>();
	for (let box of boxes) {
		let top = Math.round(box.top);
		byTop.set(top, [...(byTop.get(top) ?? []), box]);
	}
	return [...byTop.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

/** Asserts that the last row spans the first row's width, or leaves equal slack on both sides. */
function expectBalancedLastRow(boxes: DOMRect[], label: string) {
	let all = rows(boxes);
	let first = all[0]!;
	let last = all[all.length - 1]!;
	let left = Math.min(...first.map((box) => box.left));
	let right = Math.max(...first.map((box) => box.right));
	let lastLeft = Math.min(...last.map((box) => box.left));
	let lastRight = Math.max(...last.map((box) => box.right));
	let fills = Math.abs(lastLeft - left) < 1.5 && Math.abs(lastRight - right) < 1.5;
	let centred = Math.abs(lastLeft - left - (right - lastRight)) < 1.5;

	expect(
		fills || centred,
		`${label}: last row ${lastLeft}–${lastRight} under ${left}–${right}`,
	).toBe(true);
}

/** The boxes of the elements matching `selector` inside `root`. */
function boxes(root: HTMLElement, selector: string): DOMRect[] {
	return [...root.querySelectorAll(selector)].map((element) => element.getBoundingClientRect());
}

/** A bare wordmark-sized mark, so the cloud's cells rule and centre whatever it holds. */
function mark(index: number): RemixNode {
	return (
		<svg key={index} viewBox="0 0 120 28" role="img" aria-label={`Mark ${index}`}>
			<rect width="120" height="28" />
		</svg>
	);
}

/** Every grid under test, built for a given item count. */
const GRIDS: ReadonlyArray<{
	name: string;
	selector: string;
	build: (count: number) => RemixNode;
}> = [
	{
		name: "Feature.Grid",
		selector: '[data-slot="feature"]',
		build: (count) => (
			<Feature.Grid columns={3}>
				{range(count).map((index) => (
					<Feature key={index}>
						<Feature.Title>Claim {index}</Feature.Title>
					</Feature>
				))}
			</Feature.Grid>
		),
	},
	{
		name: "Bento",
		selector: '[data-slot="bento-cell"]',
		build: (count) => (
			<Bento columns={3}>
				{range(count).map((index) => (
					<Bento.Cell key={index}>
						<Bento.Title>Cell {index}</Bento.Title>
					</Bento.Cell>
				))}
			</Bento>
		),
	},
	{
		name: "StatStrip",
		selector: '[data-slot="stat-strip-item"]',
		build: (count) => (
			<StatStrip>
				{range(count).map((index) => (
					<StatStrip.Item key={index} label="Label">
						{index}
					</StatStrip.Item>
				))}
			</StatStrip>
		),
	},
	{
		name: "StepList",
		selector: '[data-slot="step-list-item"]',
		build: (count) => (
			<StepList>
				{range(count).map((index) => (
					<StepList.Item key={index} title={`Step ${index}`}>
						Body
					</StepList.Item>
				))}
			</StepList>
		),
	},
	{
		name: "PricingBand",
		selector: '[data-slot="pricing-plan"]',
		build: (count) => (
			<PricingBand title="Pricing" columns={3}>
				{range(count).map((index) => (
					<PricingBand.Plan
						key={index}
						name={`Plan ${index}`}
						price="$9"
						action={<a href="/a">Start</a>}
					/>
				))}
			</PricingBand>
		),
	},
	{
		name: "TestimonialBand",
		selector: '[data-slot="testimonial-quote"]',
		build: (count) => (
			<TestimonialBand title="Quotes" columns={3}>
				{range(count).map((index) => (
					<TestimonialBand.Quote key={index} name={`Person ${index}`}>
						Quote {index}
					</TestimonialBand.Quote>
				))}
			</TestimonialBand>
		),
	},
	{
		name: "LogoCloud grid",
		selector: '[data-slot="logo-cloud-marks"] > *',
		build: (count) => <LogoCloud layout="grid">{range(count).map(mark)}</LogoCloud>,
	},
	{
		name: "LogoCloud row",
		selector: '[data-slot="logo-cloud-marks"] > *',
		build: (count) => <LogoCloud>{range(count).map(mark)}</LogoCloud>,
	},
	{
		name: "LogoCloud spread",
		selector: '[data-slot="logo-cloud-marks"] > *',
		build: (count) => <LogoCloud layout="spread">{range(count).map(mark)}</LogoCloud>,
	},
];

describe("marketing grids leave no short last row hanging", () => {
	for (let grid of GRIDS) {
		test(`${grid.name} fills or centres its last row for 2–9 items`, () => {
			for (let width of WIDTHS) {
				for (let count of COUNTS) {
					let root = mount(width, grid.build(count));
					expectBalancedLastRow(boxes(root, grid.selector), `${grid.name} ${count} @${width}`);
					root.remove();
				}
			}
		});
	}

	test("the ruled logo grid evens six marks into rows of three where four would fit", () => {
		let root = mount(700, <LogoCloud layout="grid">{range(6).map(mark)}</LogoCloud>);

		expect(
			rows(boxes(root, '[data-slot="logo-cloud-marks"] > *')).map((row) => row.length),
		).toEqual([3, 3]);
	});

	test("the ruled logo grid stretches each cell across its tracks", () => {
		let root = mount(700, <LogoCloud layout="grid">{range(4).map(mark)}</LogoCloud>);
		let marks = root.querySelector('[data-slot="logo-cloud-marks"]')!.getBoundingClientRect();
		let cells = boxes(root, '[data-slot="logo-cloud-marks"] > *');

		expect(cells.reduce((sum, cell) => sum + cell.width, 0)).toBeCloseTo(marks.width, 0);
	});

	test("a page rounds the corners cards share with --ui-marketing-card-radius-inner", () => {
		let root = mount(
			1200,
			<div style="--ui-marketing-card-radius-inner: 20px">
				<Bento columns={3}>
					{range(6).map((index) => (
						<Bento.Cell key={index}>
							<Bento.Title>Cell {index}</Bento.Title>
						</Bento.Cell>
					))}
				</Bento>
			</div>,
		);
		let middle = root.querySelectorAll('[data-slot="bento-cell"]')[1]!;

		expect(getComputedStyle(middle).borderEndEndRadius).toBe("20px");
		expect(getComputedStyle(middle).borderStartStartRadius).toBe("20px");
	});
});
