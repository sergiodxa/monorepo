/**
 * Renders `FlightOption` in a real browser: a round trip reads as two journeys, the price and
 * action sit under them in a narrow column and beside them in a wide one, a featured row is
 * ringed, and the row fits 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { FlightOption } from "./flight-option.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a round-trip result row `width` pixels wide and returns its article. */
function mount(width: number, featured?: boolean): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<form action="/book">
			<FlightOption
				aria-label="Larkwing Air, $412"
				price="$412"
				priceDetail="Round trip per person"
				badges={<span>Cheapest</span>}
				featured={featured}
				action={
					<button type="submit" name="option" value="lw-214">
						Select
					</button>
				}
			>
				<FlightOption.Journey
					airline="Larkwing Air"
					departure={{ time: "08:40", code: "MRW" }}
					arrival={{ time: "10:55", code: "VLS" }}
					duration="2h 15m"
					stopsLabel="Nonstop"
				/>
				<FlightOption.Journey
					airline="Larkwing Air"
					departure={{ time: "22:10", code: "VLS" }}
					arrival={{ time: "06:05", code: "MRW" }}
					duration="7h 55m"
					stops={1}
					stopsLabel="1 stop · OSK"
					dayOffset="+1"
				/>
			</FlightOption>
		</form>,
		{ container: host },
	);
	return host.querySelector("article")!;
}

describe("FlightOption", () => {
	test("is a named article holding one journey per direction", () => {
		let row = mount(640);
		expect(row.getAttribute("aria-label")).toBe("Larkwing Air, $412");
		let journeys = row.querySelectorAll("[data-slot=flight-option-journey]");
		expect(journeys).toHaveLength(2);
		expect(journeys[1]!.querySelectorAll("[data-slot=flight-route-stop]")).toHaveLength(1);
		expect(row.querySelector("[data-slot=flight-option-amount]")?.textContent).toBe("$412");
	});

	test("submits its action with no script", () => {
		let row = mount(640);
		let form = row.closest("form")!;
		let submitted: FormData | undefined;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			submitted = new FormData(form, (event as SubmitEvent).submitter);
		});
		row.querySelector<HTMLButtonElement>("button")!.click();
		expect(submitted?.get("option")).toBe("lw-214");
	});

	test("puts the price under the journeys when narrow and beside them when wide", () => {
		let narrow = mount(380);
		let journeys = narrow
			.querySelector("[data-slot=flight-option-journeys]")!
			.getBoundingClientRect();
		let price = narrow.querySelector("[data-slot=flight-option-price]")!.getBoundingClientRect();
		expect(price.top).toBeGreaterThanOrEqual(journeys.bottom - 0.5);
		mounted?.cleanup();
		document.body.replaceChildren();

		let wide = mount(720);
		journeys = wide.querySelector("[data-slot=flight-option-journeys]")!.getBoundingClientRect();
		price = wide.querySelector("[data-slot=flight-option-price]")!.getBoundingClientRect();
		expect(price.left).toBeGreaterThanOrEqual(journeys.right - 0.5);
	});

	test("rings a featured row in the brand colour", () => {
		let plain = getComputedStyle(mount(640)).boxShadow;
		mounted?.cleanup();
		document.body.replaceChildren();
		let featured = mount(640, true);
		expect(featured.dataset.featured).toBe("");
		expect(getComputedStyle(featured).boxShadow).not.toBe(plain);
	});

	test("fits a 320px column without overflowing", () => {
		let row = mount(320);
		expect(row.scrollWidth).toBeLessThanOrEqual(320);
		let right = row.getBoundingClientRect().right + 0.5;
		for (let part of row.querySelectorAll("[data-slot]")) {
			expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(right);
		}
	});
});
