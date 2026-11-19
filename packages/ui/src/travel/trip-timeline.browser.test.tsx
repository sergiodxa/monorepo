/**
 * Renders `TripTimeline` in a real browser: days are headings over ordered items, each item is
 * heard with its kind's words and shows its time, status and actions, the rail joins markers
 * within a day and stops at its last item, times move into a column when wide, and it fits 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { TripTimeline } from "./trip-timeline.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a two-day trip `width` pixels wide and returns its list. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<TripTimeline
			aria-label="Trip to Vellis"
			kindLabels={{
				flight: "Flight",
				stay: "Stay",
				car: "Car",
				activity: "Activity",
				note: "Note",
			}}
		>
			<TripTimeline.Day heading="Fri 14 Mar" date="2026-03-14" detail="Day 1 · Merrow">
				<TripTimeline.Item
					kind="flight"
					time="08:40"
					dateTime="2026-03-14T08:40"
					title="LW 214 Merrow → Vellis"
					details={["Terminal 2 · Gate B14", "Confirmation LWX4Q2"]}
					status={<span>Confirmed</span>}
					actions={<a href="/trip/lw214.ics">Add to calendar</a>}
				/>
				<TripTimeline.Item kind="car" time="11:30" title="Pick up at Tallow Rent" />
				<TripTimeline.Item kind="stay" time="15:00" title="Check in at Hotel Saltmarsh" />
			</TripTimeline.Day>
			<TripTimeline.Day heading="Sat 15 Mar" date="2026-03-15">
				<TripTimeline.Item kind="activity" time="10:00" title="Harbour walking tour" />
				<TripTimeline.Item kind="note" title="Pack a light jacket for the evening" />
			</TripTimeline.Day>
		</TripTimeline>,
		{ container: host },
	);
	return host.querySelector<HTMLElement>("[data-slot=trip-timeline]")!;
}

describe("TripTimeline", () => {
	test("heads each day with its date and lists its items in order", () => {
		let list = mount(640);
		expect(list.tagName).toBe("OL");
		expect(list.getAttribute("aria-label")).toBe("Trip to Vellis");
		let headings = [...list.querySelectorAll("[data-slot=trip-timeline-day-heading]")];
		expect(headings.map((heading) => heading.tagName)).toEqual(["H3", "H3"]);
		expect(headings[0]!.querySelector("time")?.getAttribute("datetime")).toBe("2026-03-14");
		let kinds = [...list.querySelectorAll<HTMLElement>("[data-slot=trip-timeline-item]")].map(
			(item) => item.dataset.kind,
		);
		expect(kinds).toEqual(["flight", "car", "stay", "activity", "note"]);
	});

	test("leads each title with its kind's words and hides the icon", () => {
		let list = mount(640);
		let flight = list.querySelector("[data-kind=flight]")!;
		expect(flight.querySelector("[data-slot=trip-timeline-title]")?.textContent).toBe(
			"Flight: LW 214 Merrow → Vellis",
		);
		expect(
			flight.querySelector("[data-slot=trip-timeline-icon]")?.getAttribute("aria-hidden"),
		).toBe("true");
		expect(flight.querySelector("[data-slot=trip-timeline-status]")?.textContent).toBe("Confirmed");
		expect(flight.querySelector("[data-slot=trip-timeline-actions] a")?.getAttribute("href")).toBe(
			"/trip/lw214.ics",
		);
		expect([...flight.querySelectorAll("[data-slot=trip-timeline-details] li")]).toHaveLength(2);
	});

	test("runs the rail from each marker towards the next and stops at a day's last item", () => {
		let list = mount(640);
		let markers = [...list.querySelectorAll("[data-slot=trip-timeline-marker]")];
		let rail = getComputedStyle(markers[0]!, "::after");
		expect(rail.display).not.toBe("none");
		expect(rail.width).toBe("2px");
		expect(getComputedStyle(markers[2]!, "::after").display).toBe("none");
		let firstIcon = markers[0]!
			.querySelector("[data-slot=trip-timeline-icon]")!
			.getBoundingClientRect();
		let nextIcon = markers[1]!
			.querySelector("[data-slot=trip-timeline-icon]")!
			.getBoundingClientRect();
		let railBottom = firstIcon.top + parseFloat(rail.top) + parseFloat(rail.height);
		expect(railBottom).toBeLessThanOrEqual(nextIcon.top + 0.5);
		expect(railBottom).toBeGreaterThan(nextIcon.top - 8);
	});

	test("sets the time over the title when narrow and in a column before the rail when wide", () => {
		let narrow = mount(360);
		let item = narrow.querySelector("[data-kind=flight]")!;
		let time = item.querySelector("[data-slot=trip-timeline-time]")!.getBoundingClientRect();
		let icon = item.querySelector("[data-slot=trip-timeline-icon]")!.getBoundingClientRect();
		expect(time.left).toBeGreaterThanOrEqual(icon.right);
		mounted?.cleanup();
		document.body.replaceChildren();

		let wide = mount(640);
		item = wide.querySelector("[data-kind=flight]")!;
		time = item.querySelector("[data-slot=trip-timeline-time]")!.getBoundingClientRect();
		icon = item.querySelector("[data-slot=trip-timeline-icon]")!.getBoundingClientRect();
		expect(time.right).toBeLessThanOrEqual(icon.left);
	});

	test("fits a 320px column without overflowing", () => {
		let list = mount(320);
		expect(list.scrollWidth).toBeLessThanOrEqual(320);
		let right = list.getBoundingClientRect().right + 0.5;
		for (let part of list.querySelectorAll("[data-slot]")) {
			expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(right);
		}
	});
});
