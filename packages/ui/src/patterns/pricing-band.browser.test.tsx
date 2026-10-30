/**
 * Lays the pricing and testimonial bands out in a real browser: the featured plan reads
 * first on a phone, plans share one row on a wide band or centre a lone last plan, their
 * actions line up in the CTA chrome, and testimonial cards fill rows of columns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Button } from "../components/button.js";
import { marketingCtaChrome } from "../styles/marketing.js";

import { CheckRow } from "./check-row.js";
import { PricingBand } from "./pricing-band.js";
import { TestimonialBand } from "./testimonial-band.js";

import "../reset.css";

/** Mounts a band in a column of the given width attached to the document, so it gets real layout. */
function mount(width: number, node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** Three plans with the middle one featured and a longer feature list on the last. */
function plans(): RemixNode {
	return (
		<PricingBand title="Pricing">
			<PricingBand.Plan name="Hobby" price="$0" action={<a href="/a">Start</a>} />
			<PricingBand.Plan
				name="Team"
				price="$29"
				period="/month"
				featured
				action={<a href="/b">Start</a>}
			/>
			<PricingBand.Plan
				name="Business"
				price="$99"
				period="/month"
				features={
					<>
						<CheckRow>One</CheckRow>
						<CheckRow>Two</CheckRow>
						<CheckRow>Three</CheckRow>
					</>
				}
				action={<a href="/c">Start</a>}
			/>
		</PricingBand>
	);
}

/** The rendered box of each plan card, in source order. */
function cards(root: HTMLElement): DOMRect[] {
	return [...root.querySelectorAll('[data-slot="pricing-plan"]')].map((card) =>
		card.getBoundingClientRect(),
	);
}

describe("pricing band layout", () => {
	test("a phone-width band stacks the plans with the featured one first", () => {
		let root = mount(375, plans());
		let [hobby, team, business] = cards(root);

		expect(team!.top).toBeLessThan(hobby!.top);
		expect(hobby!.top).toBeLessThan(business!.top);
		expect(team!.left).toBe(hobby!.left);
	});

	test("a wide band sets every plan in one row with their actions aligned", () => {
		let root = mount(900, plans());
		let [hobby, team, business] = cards(root);
		let actions = [...root.querySelectorAll('[data-slot="pricing-plan-action"]')].map(
			(action) => action.getBoundingClientRect().top,
		);

		expect(team!.top).toBe(hobby!.top);
		expect(business!.top).toBe(hobby!.top);
		expect(hobby!.right).toBeLessThanOrEqual(team!.left);
		expect(team!.right).toBeLessThanOrEqual(business!.left);
		expect(new Set(actions).size).toBe(1);
	});
});

describe("pricing band rows and actions", () => {
	test("three plans at 768px stack one a row at the full width, with none left alone", () => {
		let root = mount(768, plans());
		let grid = root.querySelector('[data-slot="pricing-plans"]')!.getBoundingClientRect();
		let [hobby, team, business] = cards(root);

		for (let card of [hobby!, team!, business!]) {
			expect(card.left).toBeCloseTo(grid.left, 0);
			expect(card.right).toBeCloseTo(grid.right, 0);
		}
		expect(team!.top).toBeGreaterThan(hobby!.bottom);
		expect(business!.top).toBeGreaterThan(team!.bottom);
	});

	test("four plans at 768px pair up in two full rows", () => {
		let root = mount(
			768,
			<PricingBand title="Pricing">
				<PricingBand.Plan name="One" price="$0" action={<a href="/1">Start</a>} />
				<PricingBand.Plan name="Two" price="$9" action={<a href="/2">Start</a>} />
				<PricingBand.Plan name="Three" price="$29" action={<a href="/3">Start</a>} />
				<PricingBand.Plan name="Four" price="$99" action={<a href="/4">Start</a>} />
			</PricingBand>,
		);
		let [one, two, three, four] = cards(root);

		expect(two!.top).toBe(one!.top);
		expect(four!.top).toBe(three!.top);
		expect(three!.left).toBe(one!.left);
		expect(four!.right).toBe(two!.right);
	});

	test("plan actions match a hero CTA's height and pill radius", () => {
		let root = mount(
			900,
			<div style={{ "--ui-marketing-cta-radius": "9999px" }}>
				<Button color="brand" mix={[marketingCtaChrome()]}>
					Start free
				</Button>
				<PricingBand title="Pricing">
					<PricingBand.Plan name="Team" price="$29" action={<Button color="brand">Start</Button>} />
				</PricingBand>
			</div>,
		);
		let [hero, plan] = [...root.querySelectorAll("button")].map((button) => ({
			height: button.getBoundingClientRect().height,
			radius: getComputedStyle(button).borderStartStartRadius,
			shadow: getComputedStyle(button).boxShadow,
		}));

		expect(plan!.height).toBe(hero!.height);
		expect(plan!.height).toBe(40);
		expect(plan!.radius).toBe(hero!.radius);
		expect(plan!.shadow).toBe(hero!.shadow);
	});
});

describe("pricing band plan tokens", () => {
	test("a page squares and flattens every plan through the plan tokens", () => {
		let root = mount(
			900,
			<div style={{ "--ui-marketing-plan-radius": "0px", "--ui-marketing-plan-lift": "0 0 #0000" }}>
				{plans()}
			</div>,
		);
		let plain = root.querySelector('[data-slot="pricing-plan"]:not([data-featured])');
		let featured = root.querySelector('[data-slot="pricing-plan"][data-featured]');

		expect(getComputedStyle(plain!).borderStartStartRadius).toBe("0px");
		expect(getComputedStyle(featured!).borderStartStartRadius).toBe("0px");
		expect(getComputedStyle(featured!, "::after").boxShadow).toBe(
			"rgba(0, 0, 0, 0) 0px 0px 0px 0px",
		);
	});

	test("plans keep their rounded corners and lift when no token is set", () => {
		let root = mount(900, plans());
		let featured = root.querySelector('[data-slot="pricing-plan"][data-featured]');

		expect(getComputedStyle(featured!).borderStartStartRadius).toBe("24px");
		expect(getComputedStyle(featured!, "::after").boxShadow).not.toBe("none");
	});
});

describe("testimonial band layout", () => {
	test("a wide band flows quotes into three columns and a phone into one", () => {
		let quotes = (
			<TestimonialBand title="Quotes">
				<TestimonialBand.Quote name="A">One</TestimonialBand.Quote>
				<TestimonialBand.Quote name="B">Two</TestimonialBand.Quote>
				<TestimonialBand.Quote name="C">Three</TestimonialBand.Quote>
			</TestimonialBand>
		);
		let lefts = (root: HTMLElement) =>
			new Set(
				[...root.querySelectorAll("figure")].map((figure) => figure.getBoundingClientRect().left),
			);

		expect(lefts(mount(900, quotes)).size).toBe(3);
		expect(lefts(mount(375, quotes)).size).toBe(1);
	});
});
