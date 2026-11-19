/**
 * Holds the product card to its contract in a real browser: the title link covers the card
 * as its one tab stop, the action stays clickable above it, and colours stop at five then "+N".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { ProductCard } from "./product-card.js";

import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Seven colours, two more than the card draws. */
const SWATCHES = ["#111", "#222", "#333", "#444", "#555", "#666", "#777"].map((color, index) => ({
	name: `Colour ${index + 1}`,
	color,
}));

/** Mounts a card 240px wide and returns its article. */
function mount(): HTMLElement {
	mounted = render(
		<div style={{ inlineSize: "240px" }}>
			<ProductCard
				href="/posters/dune"
				title="Dune at dusk"
				subtitle="Ana Ortiz"
				media={<svg viewBox="0 0 4 5" />}
				hoverMedia={<svg viewBox="0 0 4 5" />}
				price="$45.00"
				badges={<span>New</span>}
				swatches={SWATCHES}
				action={
					<button type="button" aria-label="Save">
						♡
					</button>
				}
			/>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="product-card"]')!;
}

describe("ProductCard", () => {
	test("is an article whose one link is the title, stretched over the card", () => {
		let card = mount();
		let links = card.querySelectorAll("a");
		expect(card.tagName).toBe("ARTICLE");
		expect(links).toHaveLength(1);
		expect(links[0]!.getAttribute("href")).toBe("/posters/dune");
		let box = card.getBoundingClientRect();
		let center = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
		expect(center === links[0] || links[0]!.contains(center)).toBe(true);
	});

	test("keeps the action above the stretched link", () => {
		let card = mount();
		let action = card.querySelector("button")!;
		let box = action.getBoundingClientRect();
		expect(document.elementFromPoint(box.left + 4, box.top + 4)).toBe(action);
	});

	test("draws the picture at 4 / 5 and hides the hover picture at rest", () => {
		let card = mount();
		let media = card.querySelector<HTMLElement>('[data-slot="product-card-media"]')!;
		let box = media.getBoundingClientRect();
		expect(Math.round((box.width / box.height) * 100)).toBe(80);
		let hover = card.querySelector<HTMLElement>('[data-slot="product-card-hover"]')!;
		expect(getComputedStyle(hover).opacity).toBe("0");
	});

	test("shows five colours then counts the rest", () => {
		let card = mount();
		expect(card.querySelectorAll('[data-slot="product-card-swatch"]')).toHaveLength(5);
		expect(card.querySelector('[data-slot="product-card-swatch-more"]')!.textContent).toBe("+2");
		expect(card.querySelector("ul")!.getAttribute("aria-label")).toBe("Colours");
	});
});
