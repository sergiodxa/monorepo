/**
 * Renders `FlightSegment` and `FlightRoute` in a real browser: the leg reads departure,
 * duration and arrival in order, the track draws a dot per stop, the day badge is heard as
 * its label, the airline moves beside the route when wide, and nothing overflows at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { FlightRoute, FlightSegment } from "./flight-segment.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts an overnight one-stop leg `width` pixels wide and returns its host. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<FlightSegment
			airline="Larkwing Air"
			mark={<svg viewBox="0 0 10 10" />}
			flightNumber="LW 214"
			departure={{ time: "22:40", dateTime: "2026-03-14T22:40", code: "MRW", city: "Merrow" }}
			arrival={{ time: "06:05", dateTime: "2026-03-15T06:05", code: "OSK", city: "Oskarn" }}
			duration="7h 25m"
			stops={1}
			stopsLabel="1 stop · VLS"
			dayOffset="+1"
			dayOffsetLabel="arrives the next day"
			labels={{ departs: "Departs", arrives: "Arrives", duration: "Flight time" }}
			aircraft="Aerion 320neo"
			cabin="Economy"
		/>,
		{ container: host },
	);
	return host.querySelector<HTMLElement>("[data-slot=flight-segment]")!;
}

describe("FlightSegment", () => {
	test("reads the airline, then departure, duration and arrival in order", () => {
		let segment = mount(480);
		expect(segment.querySelector("[data-slot=flight-segment-airline]")?.textContent).toBe(
			"Larkwing Air",
		);
		expect(segment.querySelector("[data-slot=flight-segment-number]")?.textContent).toBe("LW 214");
		let route = segment.querySelector("[data-slot=flight-route]")!;
		expect(route.querySelector("[data-slot=flight-route-departure]")?.textContent).toBe(
			"Departs 22:40MRW Merrow",
		);
		expect(route.querySelector("[data-slot=flight-route-duration]")?.textContent).toBe(
			"Flight time 7h 25m",
		);
		expect(
			route.querySelector("[data-slot=flight-route-arrival] time")?.getAttribute("datetime"),
		).toBe("2026-03-15T06:05");
		expect(
			[...segment.querySelectorAll("[data-slot=flight-segment-meta] li")].map(
				(li) => li.textContent,
			),
		).toEqual(["Aerion 320neo", "Economy"]);
	});

	test("hides the drawn track and the airline mark from assistive technology", () => {
		let segment = mount(480);
		expect(
			segment.querySelector("[data-slot=flight-route-track]")?.getAttribute("aria-hidden"),
		).toBe("true");
		expect(
			segment.querySelector("[data-slot=flight-segment-mark]")?.getAttribute("aria-hidden"),
		).toBe("true");
	});

	test("reads the day badge as its label", () => {
		let segment = mount(480);
		let badge = segment.querySelector("[data-slot=flight-route-day-offset]")!;
		expect(badge.textContent).toBe("+1");
		expect(badge.getAttribute("aria-hidden")).toBe("true");
		expect(badge.parentElement?.textContent).toContain("arrives the next day");
	});

	test("draws one dot per stop between the two ends", () => {
		let segment = mount(480);
		expect(segment.querySelectorAll("[data-slot=flight-route-stop]")).toHaveLength(1);
		let track = segment.querySelector<HTMLElement>("[data-slot=flight-route-track]")!;
		expect(track.getBoundingClientRect().width).toBeGreaterThan(40);
	});

	test("heads the leg with the airline when narrow and sets it beside the route when wide", () => {
		let narrow = mount(360);
		let carrier = narrow
			.querySelector("[data-slot=flight-segment-carrier]")!
			.getBoundingClientRect();
		let route = narrow.querySelector("[data-slot=flight-route]")!.getBoundingClientRect();
		expect(route.top).toBeGreaterThanOrEqual(carrier.bottom);
		mounted?.cleanup();
		document.body.replaceChildren();

		let wide = mount(720);
		carrier = wide.querySelector("[data-slot=flight-segment-carrier]")!.getBoundingClientRect();
		route = wide.querySelector("[data-slot=flight-route]")!.getBoundingClientRect();
		expect(route.left).toBeGreaterThanOrEqual(carrier.right);
		expect(route.top).toBeLessThan(carrier.bottom);
	});

	test("fits a 320px column without overflowing", () => {
		let segment = mount(320);
		expect(segment.scrollWidth).toBeLessThanOrEqual(320);
		let right = segment.getBoundingClientRect().right + 0.5;
		for (let part of segment.querySelectorAll("[data-slot^=flight-route-]")) {
			expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(right);
		}
	});
});

describe("FlightRoute", () => {
	test("draws a clear line for a nonstop flight", () => {
		let host = document.createElement("div");
		host.style.width = "300px";
		document.body.appendChild(host);
		mounted = render(
			<FlightRoute
				departure={{ time: "08:40", code: "MRW" }}
				arrival={{ time: "10:55", code: "VLS" }}
				duration="2h 15m"
				stopsLabel="Nonstop"
			/>,
			{ container: host },
		);
		expect(host.querySelectorAll("[data-slot=flight-route-stop]")).toHaveLength(0);
		expect(host.querySelector("[data-slot=flight-route-stops]")?.textContent).toBe("Nonstop");
		expect(host.querySelector("[data-slot=flight-route-day-offset]")).toBeNull();
	});
});
