/**
 * Renders `CarOffer` in a real browser: the class and model head the card as a heading, each
 * spec chip pairs a hidden icon with its words, the picture heads the card when narrow and
 * leads a row when wide, and the card fits 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { HeadingScope } from "../components/heading-scope.js";

import { CarOffer } from "./car-offer.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a compact car offer `width` pixels wide and returns its article. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<CarOffer
			art={<svg viewBox="0 0 160 100" role="img" aria-label="Compact car" />}
			category="Compact"
			model="Velo C3 or similar"
			specs={[
				{ kind: "seats", label: "5 seats" },
				{ kind: "bags", label: "2 bags" },
				{ kind: "transmission", label: "Automatic" },
				{ kind: "electric", label: "Electric" },
				{ kind: "ac", label: "A/C" },
			]}
			perks={["Free cancellation", "Unlimited mileage"]}
			vendor="Tallow Rent"
			rating="8.6 · Excellent"
			pickup="In terminal · Merrow Airport"
			price="$38"
			priceUnit="/ day"
			total="$266 total"
			actions={<a href="/cars/c3">View deal</a>}
		/>,
		{ container: host },
	);
	return host.querySelector("article")!;
}

describe("CarOffer", () => {
	test("heads the card with the class and model at the default level", () => {
		let card = mount(640);
		let heading = card.querySelector("[data-slot=car-offer-title]")!;
		expect(heading.tagName).toBe("H3");
		expect(heading.textContent).toBe("Compact · Velo C3 or similar");
	});

	test("takes the ambient heading level inside a scope", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		mounted = render(
			<HeadingScope>
				<HeadingScope>
					<CarOffer category="Midsize" price="$52" />
				</HeadingScope>
			</HeadingScope>,
			{ container: host },
		);
		expect(host.querySelector("[data-slot=car-offer-title]")?.tagName).toBe("H2");
	});

	test("pairs every spec's words with a hidden icon", () => {
		let card = mount(640);
		let specs = [...card.querySelectorAll<HTMLElement>("[data-slot=car-offer-spec]")];
		expect(specs.map((spec) => spec.textContent)).toEqual([
			"5 seats",
			"2 bags",
			"Automatic",
			"Electric",
			"A/C",
		]);
		for (let spec of specs) {
			expect(spec.querySelector("svg")?.closest("[aria-hidden=true]")).not.toBeNull();
		}
	});

	test("shows the company, its rating, the pickup point and both prices", () => {
		let card = mount(640);
		expect(card.querySelector("[data-slot=car-offer-vendor-name]")?.textContent).toBe(
			"Tallow Rent",
		);
		expect(card.querySelector("[data-slot=car-offer-rating]")?.textContent).toBe("8.6 · Excellent");
		expect(card.querySelector("[data-slot=car-offer-pickup]")?.textContent).toBe(
			"In terminal · Merrow Airport",
		);
		expect(card.querySelector("[data-slot=car-offer-amount]")?.textContent).toBe("$38");
		expect(card.querySelector("[data-slot=car-offer-total]")?.textContent).toBe("$266 total");
		expect(card.querySelector("[data-slot=car-offer-actions] a")?.getAttribute("href")).toBe(
			"/cars/c3",
		);
	});

	test("heads the card with the picture when narrow and leads a row with it when wide", () => {
		let narrow = mount(360);
		let art = narrow.querySelector("[data-slot=car-offer-art]")!.getBoundingClientRect();
		let details = narrow.querySelector("[data-slot=car-offer-details]")!.getBoundingClientRect();
		expect(details.top).toBeGreaterThanOrEqual(art.bottom - 0.5);
		mounted?.cleanup();
		document.body.replaceChildren();

		let wide = mount(800);
		art = wide.querySelector("[data-slot=car-offer-art]")!.getBoundingClientRect();
		details = wide.querySelector("[data-slot=car-offer-details]")!.getBoundingClientRect();
		let price = wide.querySelector("[data-slot=car-offer-price]")!.getBoundingClientRect();
		expect(details.left).toBeGreaterThanOrEqual(art.right - 0.5);
		expect(price.left).toBeGreaterThanOrEqual(details.right - 0.5);
	});

	test("fits a 320px column without overflowing", () => {
		let card = mount(320);
		expect(card.scrollWidth).toBeLessThanOrEqual(320);
		let right = card.getBoundingClientRect().right + 0.5;
		for (let part of card.querySelectorAll("[data-slot]")) {
			expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(right);
		}
	});
});
