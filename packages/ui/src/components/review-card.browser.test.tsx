/**
 * Holds the review card to its contract in a real browser: a review lays out its stars, title,
 * words and a footer with the helpful slot pushed to the end, and leaves out what it lacks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { ReviewCard } from "./review-card.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("ReviewCard", () => {
	test("lays out the stars, title, words and a footer with the helpful slot at the end", () => {
		mounted = render(
			<div style={{ inlineSize: "40rem" }}>
				<ReviewCard
					author="Maya R."
					rating={5}
					title="Better in person"
					body={<p>The paper is heavy and the colours are rich.</p>}
					date="2 weeks ago"
					verified="Verified buyer"
					meta="50×70 · Oak frame"
					helpful={<button type="button">Helpful (3)</button>}
				/>
			</div>,
		);
		let card = mounted.container.querySelector<HTMLElement>('[data-slot="review-card"]')!;
		expect(card.tagName).toBe("ARTICLE");
		expect(card.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe("5 out of 5 stars");
		expect(card.querySelector('[data-slot="review-card-title"]')!.textContent).toBe(
			"Better in person",
		);
		let footer = card.querySelector<HTMLElement>('[data-slot="review-card-footer"]')!;
		expect(footer.textContent).toBe("Maya R.2 weeks agoVerified buyer50×70 · Oak frameHelpful (3)");
		let helpful = footer.querySelector<HTMLElement>('[data-slot="review-card-helpful"]')!;
		expect(Math.round(helpful.getBoundingClientRect().right)).toBe(
			Math.round(footer.getBoundingClientRect().right),
		);
	});

	test("leaves out the parts it was not given", () => {
		mounted = render(<ReviewCard author="Sam" rating={3} body="Fine." date="Today" />);
		let card = mounted.container.querySelector<HTMLElement>('[data-slot="review-card"]')!;
		expect(card.querySelector('[data-slot="review-card-title"]')).toBeNull();
		expect(card.querySelector('[data-slot="review-card-verified"]')).toBeNull();
		expect(card.querySelector('[data-slot="review-card-helpful"]')).toBeNull();
	});
});
