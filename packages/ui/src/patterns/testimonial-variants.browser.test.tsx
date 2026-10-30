/**
 * Lays the {@link TestimonialBand} variants out in a real browser: a featured quote spans
 * the band above the grid in larger type, a story link closes its card, and a carousel
 * scrolls one row of cards inside itself while the page stays put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { TestimonialBand } from "./testimonial-band.js";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** Five ordinary quotes. */
function quotes(): JSX.Element[] {
	return ["Ana", "Ben", "Cai", "Dee", "Eli"].map((name) => (
		<TestimonialBand.Quote key={name} name={name} jobTitle="SRE">
			We caught the outage before our customers did.
		</TestimonialBand.Quote>
	));
}

/** Every quote card in `host`. */
function cards(host: HTMLElement): HTMLElement[] {
	return [...host.querySelectorAll<HTMLElement>('[data-slot="testimonial-quote"]')];
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("TestimonialBand featured", () => {
	test("spans the band above the grid in larger type, closed by its story link", () => {
		let host = mount(
			<TestimonialBand
				title="Teams that sleep through the night"
				featured={
					<TestimonialBand.Quote
						variant="featured"
						name="Ana"
						jobTitle="VP Eng"
						href="/customers/lumen"
					>
						Alert noise fell <strong>by 83%</strong> in the first month.
					</TestimonialBand.Quote>
				}
			>
				{quotes().slice(0, 3)}
			</TestimonialBand>,
			1024,
		);
		let [featured, first] = cards(host);
		let grid = host.querySelector<HTMLElement>('[data-slot="testimonial-quotes"]')!;
		let link = featured!.querySelector<HTMLElement>('[data-slot="testimonial-link"]')!;

		expect(featured!.getBoundingClientRect().width).toBe(grid.getBoundingClientRect().width);
		expect(featured!.getBoundingClientRect().bottom).toBeLessThan(
			first!.getBoundingClientRect().top,
		);
		expect(
			parseFloat(getComputedStyle(featured!.querySelector("blockquote")!).fontSize),
		).toBeGreaterThan(parseFloat(getComputedStyle(first!.querySelector("blockquote")!).fontSize));
		expect(link.getAttribute("href")).toBe("/customers/lumen");
		expect(link.textContent).toContain("Read the story");
		expect(featured!.getAttribute("data-variant")).toBe("featured");
	});
});

describe("TestimonialBand carousel", () => {
	test("keeps five quotes on one scrolling row with the next card's edge in view", () => {
		let host = mount(
			<TestimonialBand title="Quotes" layout="carousel">
				{quotes()}
			</TestimonialBand>,
			375,
		);
		let track = host.querySelector<HTMLElement>('[data-slot="testimonial-quotes"]')!;
		let tops = new Set(cards(host).map((card) => Math.round(card.getBoundingClientRect().top)));
		let [first, second] = cards(host);

		expect(tops.size).toBe(1);
		expect(getComputedStyle(track).scrollSnapType).toBe("x mandatory");
		expect(track.scrollWidth).toBeGreaterThan(track.clientWidth);
		expect(second!.getBoundingClientRect().left).toBeLessThan(track.getBoundingClientRect().right);
		expect(first!.getBoundingClientRect().width).toBeLessThan(track.clientWidth);
		expect(track.getAttribute("role")).toBe("region");
		expect(track.tabIndex).toBe(0);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
