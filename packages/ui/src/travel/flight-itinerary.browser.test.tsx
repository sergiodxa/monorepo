/**
 * Renders `FlightItinerary` in a real browser: the trip reads on one line while closed, the
 * native toggle opens every leg and the layover between them with no script, a warning
 * layover stands apart, and the journey fits a 320px column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { FlightItinerary } from "./flight-itinerary.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a one-stop overnight journey `width` pixels wide and returns its section. */
function mount(width: number, open?: boolean): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<FlightItinerary
			title="Outbound · Fri 14 Mar"
			airline="Larkwing Air"
			departure={{ time: "18:10", code: "MRW", city: "Merrow" }}
			arrival={{ time: "09:30", code: "OSK", city: "Oskarn" }}
			duration="15h 20m"
			stops={1}
			stopsLabel="1 stop"
			dayOffset="+1"
			dayOffsetLabel="arrives the next day"
			toggleLabel="Flight details"
			open={open}
		>
			<FlightItinerary.Segment
				airline="Larkwing Air"
				flightNumber="LW 214"
				departure={{ time: "18:10", code: "MRW", city: "Merrow" }}
				arrival={{ time: "20:25", code: "VLS", city: "Vellis" }}
				duration="2h 15m"
				stopsLabel="Nonstop"
				cabin="Economy"
			/>
			<FlightItinerary.Layover tone="warning" note="Overnight · change terminals">
				10h 05m layover in VLS Vellis
			</FlightItinerary.Layover>
			<FlightItinerary.Segment
				airline="Larkwing Air"
				flightNumber="LW 731"
				departure={{ time: "06:30", code: "VLS", city: "Vellis" }}
				arrival={{ time: "09:30", code: "OSK", city: "Oskarn" }}
				duration="3h 00m"
				stopsLabel="Nonstop"
				cabin="Economy"
			/>
		</FlightItinerary>,
		{ container: host },
	);
	return host.querySelector("section")!;
}

describe("FlightItinerary", () => {
	test("reads the title, stop count and total duration over the trip's one line", () => {
		let section = mount(480);
		expect(section.querySelector("[data-slot=flight-itinerary-title]")?.textContent).toBe(
			"Outbound · Fri 14 Mar",
		);
		expect(section.querySelector("[data-slot=flight-itinerary-totals]")?.textContent).toBe(
			"1 stop · 15h 20m",
		);
		let summaryRoute = section.querySelector(":scope > [data-slot=flight-route]")!;
		expect(summaryRoute.querySelectorAll("[data-slot=flight-route-stop]")).toHaveLength(1);
	});

	test("keeps the legs folded until the native toggle opens them", () => {
		let section = mount(480);
		let details = section.querySelector("details")!;
		let legs = section.querySelector<HTMLElement>("[data-slot=flight-itinerary-legs]")!;
		expect(details.open).toBe(false);
		expect(legs.checkVisibility()).toBe(false);

		section.querySelector<HTMLElement>("summary")!.click();
		expect(details.open).toBe(true);
		expect(legs.checkVisibility()).toBe(true);
		expect(section.querySelectorAll("[data-slot=flight-segment]")).toHaveLength(2);

		section.querySelector<HTMLElement>("summary")!.click();
		expect(details.open).toBe(false);
	});

	test("names the toggle with its own words and hides the chevron", () => {
		let section = mount(480);
		let summary = section.querySelector("summary")!;
		expect(summary.textContent).toBe("Flight details");
		expect(summary.querySelector("svg")?.closest("[aria-hidden=true]")).not.toBeNull();
	});

	test("lists legs and layovers in order, the warning layover set apart", () => {
		let section = mount(480, true);
		let slots = [...section.querySelectorAll("[data-slot=flight-itinerary-legs] > li")].map(
			(item) => item.getAttribute("data-slot"),
		);
		expect(slots).toEqual([
			"flight-itinerary-segment",
			"flight-itinerary-layover",
			"flight-itinerary-segment",
		]);
		let layover = section.querySelector<HTMLElement>("[data-slot=flight-itinerary-layover]")!;
		expect(layover.dataset.tone).toBe("warning");
		expect(layover.textContent).toContain("Overnight · change terminals");
		expect(getComputedStyle(layover).borderTopStyle).toBe("solid");
		let plain = section.querySelector("[data-slot=flight-itinerary-segment]")!;
		expect(getComputedStyle(layover).borderTopWidth).toBe("1px");
		expect(layover.querySelector("[aria-hidden=true] svg")).not.toBeNull();
		expect(plain.querySelector("[data-tone]")).toBeNull();
	});

	test("fits a 320px column open, without overflowing", () => {
		let section = mount(320, true);
		expect(section.scrollWidth).toBeLessThanOrEqual(320);
		let right = section.getBoundingClientRect().right + 0.5;
		for (let part of section.querySelectorAll("[data-slot]")) {
			expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(right);
		}
	});
});
