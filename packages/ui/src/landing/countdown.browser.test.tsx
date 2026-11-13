/**
 * Renders the countdown in a real browser: the server render reads the time left from `now`,
 * the island rewrites it from the viewer's clock and keeps ticking, and both swap the units for
 * the done text once the moment has passed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Countdown, CountdownLive } from "./countdown.js";

/** Mounts `node` in a fresh host and returns its `<time>`. */
function mount(node: JSX.Element): HTMLTimeElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	render(node, { container: host });
	return host.querySelector("time")!;
}

/** The figures the countdown shows, unit by unit. */
function figures(time: HTMLTimeElement): Record<string, string> {
	return Object.fromEntries(
		Array.from(time.querySelectorAll<HTMLElement>("[data-unit]"), (unit) => [
			unit.dataset.unit!,
			unit.querySelector('[data-slot="countdown-value"]')!.textContent!,
		]),
	);
}

/** Whether an element is laid out at all. */
function shown(element: Element | null): boolean {
	return element !== null && element.getClientRects().length > 0;
}

const LABELS = { days: "days", hours: "hours", minutes: "minutes", seconds: "seconds" };

afterEach(() => {
	vi.useRealTimers();
	document.body.replaceChildren();
});

describe("Countdown", () => {
	test("reads the time left from now, clock units padded, with the moment in datetime", () => {
		let time = mount(
			<Countdown to="2027-04-15T07:00:00Z" now="2027-04-13T05:58:03Z" done="Doors are open" />,
		);

		expect(time.dateTime).toBe("2027-04-15T07:00:00.000Z");
		expect(figures(time)).toEqual({ days: "2", hours: "01", minutes: "01", seconds: "57" });
		expect(time.textContent).toContain("days");
		expect(shown(time.querySelector('[data-slot="countdown-done"]'))).toBe(false);
	});

	test("leaves the seconds out when asked, and names units in the page's language", () => {
		let time = mount(
			<Countdown
				to="2027-04-15T07:00:00Z"
				now="2027-04-13T05:58:03Z"
				seconds={false}
				labels={{ days: "días", hours: "horas", minutes: "minutos" }}
				done="Abierto"
			/>,
		);

		expect(Object.keys(figures(time))).toEqual(["days", "hours", "minutes"]);
		expect(time.textContent).toContain("días");
	});

	test("sets its figures in the type an ancestor's custom properties name", () => {
		let host = document.createElement("div");
		host.style.setProperty("--ui-countdown-value-size", "40px");
		host.style.setProperty("--ui-countdown-value-color", "rgb(255, 0, 128)");
		host.style.setProperty("--ui-countdown-label-size", "9px");
		document.body.appendChild(host);
		render(<Countdown to="2027-04-15T07:00:00Z" now="2027-04-13T05:58:03Z" done="Open" />, {
			container: host,
		});

		let value = getComputedStyle(host.querySelector('[data-slot="countdown-value"]')!);
		expect(value.fontSize).toBe("40px");
		expect(value.color).toBe("rgb(255, 0, 128)");
		expect(getComputedStyle(host.querySelector('[data-slot="countdown-label"]')!).fontSize).toBe(
			"9px",
		);
	});

	test("shows the done text alone once the moment has passed", () => {
		let time = mount(
			<Countdown to="2027-04-15T07:00:00Z" now="2027-04-15T09:00:00Z" done="Doors are open" />,
		);

		expect(shown(time.querySelector('[data-slot="countdown-units"]'))).toBe(false);
		expect(time.querySelector('[data-slot="countdown-done"]')!.textContent).toBe("Doors are open");
		expect(shown(time.querySelector('[data-slot="countdown-done"]'))).toBe(true);
	});
});

describe("CountdownLive", () => {
	test("rewrites a stale server render from the viewer's clock and ticks every second", () => {
		vi.useFakeTimers({
			now: Date.parse("2027-04-15T06:59:50Z"),
			toFake: ["Date", "setInterval", "clearInterval"],
		});
		let time = mount(
			<CountdownLive
				to="2027-04-15T07:00:00Z"
				now="2027-04-10T07:00:00Z"
				labels={LABELS}
				seconds
				done="Doors are open"
			/>,
		);

		expect(figures(time)).toEqual({ days: "0", hours: "00", minutes: "00", seconds: "10" });

		vi.advanceTimersByTime(3_000);
		expect(figures(time).seconds).toBe("07");
	});

	test("swaps to the done text at zero and stops ticking", () => {
		vi.useFakeTimers({
			now: Date.parse("2027-04-15T06:59:58Z"),
			toFake: ["Date", "setInterval", "clearInterval"],
		});
		let time = mount(
			<CountdownLive
				to="2027-04-15T07:00:00Z"
				now="2027-04-15T06:59:58Z"
				labels={LABELS}
				seconds
				done="Doors are open"
			/>,
		);

		vi.advanceTimersByTime(2_000);

		expect(time.dataset.state).toBe("done");
		expect(shown(time.querySelector('[data-slot="countdown-units"]'))).toBe(false);
		expect(shown(time.querySelector('[data-slot="countdown-done"]'))).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});
});
