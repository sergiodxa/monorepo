/**
 * Lays a six-quote testimonial band out at desktop width in a real browser: every card
 * renders as one unbroken box, cards in a row share one height so columns end level,
 * and the quote grid spans the band's content width under its header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { TestimonialBand } from "./testimonial-band.js";

/** Six quotes of uneven length, the shortest last, as a three-column band shows them. */
const QUOTES = [
	"We used to send forty messages a week about milk. Now we send none, and nobody buys a second bag.",
	"My brother lives two hours away and still sees the pharmacy list. We finally split the load.",
	"I plan Sunday night, tap once, and the list is done. That tap saves me an hour every week.",
	"The rota ended the bathroom argument. It just says whose week it is and everyone accepts it.",
	"Every shared-list app I tried left me out. This one works the same on my phone as on theirs.",
	"The evening summary is the only notification I keep.",
];

/** Mounts the band in a desktop-width column and returns its header title, grid and cards. */
function mountBand() {
	let host = document.createElement("div");
	host.style.width = "1152px";
	document.body.appendChild(host);
	let { container } = render(
		<TestimonialBand title="Fewer messages about milk">
			{QUOTES.map((quote, index) => (
				<TestimonialBand.Quote key={index} name={`Person ${index}`} jobTitle="Household">
					{quote}
				</TestimonialBand.Quote>
			))}
		</TestimonialBand>,
		{ container: host },
	);
	return {
		title: container.querySelector("h1, h2, h3")!.getBoundingClientRect(),
		grid: container.querySelector('[data-slot="testimonial-quotes"]')!.getBoundingClientRect(),
		cards: [...container.querySelectorAll('[data-slot="testimonial-quote"]')],
	};
}

describe("TestimonialBand grid", () => {
	test("renders every card as one box, with no fragment left at a column break", () => {
		let { cards } = mountBand();

		for (let card of cards) expect(card.getClientRects()).toHaveLength(1);
	});

	test("ends every column at the same y, with cards in a row at one height", () => {
		let { cards } = mountBand();
		let boxes = cards.map((card) => card.getBoundingClientRect());
		let bottoms = new Set(boxes.slice(3).map((box) => Math.round(box.bottom)));
		let heights = new Set(boxes.slice(0, 3).map((box) => Math.round(box.height)));

		expect(new Set(boxes.map((box) => Math.round(box.left))).size).toBe(3);
		expect(bottoms.size).toBe(1);
		expect(heights.size).toBe(1);
	});

	test("spans the content width the header sits in", () => {
		let { grid, title } = mountBand();

		expect(grid.left).toBe(title.left);
		expect(grid.width).toBe(1152);
	});
});
