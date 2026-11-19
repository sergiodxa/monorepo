/**
 * Renders `SeatMap` in a real browser: seats sit in letter columns with an aisle between them,
 * taken seats are disabled radios, the selected seat is checked and posts with its form, the
 * spoken names carry each seat's extras, and the cabin fits a 320px column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import type { SeatMap as SeatMapTypes } from "./seat-map.js";

import { SeatMap } from "./seat-map.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Rows 10 to 24 of a three-and-three cabin: 12 is an exit row, 14C and 14D are taken. */
const ROWS: SeatMapTypes.Row[] = Array.from({ length: 15 }, (_, index) => {
	let number = 10 + index;
	return {
		number,
		seats: "ABCDEF".split("").map((letter) => {
			let id = `${number}${letter}`;
			let seat: SeatMapTypes.Seat = { id, status: "available" };
			if (id === "14C" || id === "14D") seat.status = "taken";
			if (id === "20A") seat.status = "blocked";
			if (number === 12) seat.kind = "exit";
			if (number === 10) {
				seat.kind = "extra-legroom";
				seat.price = "$35";
			}
			return seat;
		}),
	};
});

/** Mounts the cabin inside a form `width` pixels wide and returns the form. */
function mount(width: number, selected?: string): HTMLFormElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<form>
			<SeatMap
				name="seat"
				label="Choose a seat"
				labels={{
					taken: "taken",
					blocked: "unavailable",
					aisle: "aisle",
					window: "window",
					exit: "exit row",
					kinds: { "extra-legroom": "extra legroom" },
				}}
				layout="ABC DEF"
				rows={ROWS}
				selected={selected}
				deck="Main deck"
				exitRows={[12]}
				wings={[14, 19]}
				sections={[{ from: 15, title: "Economy" }]}
			/>
			<SeatMap.Legend
				items={[
					{ swatch: "available", label: "Available" },
					{ swatch: "selected", label: "Your seat" },
					{ swatch: "taken", label: "Taken" },
				]}
			/>
		</form>,
		{ container: host },
	);
	return host.querySelector("form")!;
}

/** The radio of one seat. */
function seat(form: HTMLFormElement, id: string): HTMLInputElement {
	return form.querySelector<HTMLInputElement>(`input[value="${id}"]`)!;
}

describe("SeatMap", () => {
	test("lays the seats out in letter columns with the aisle between C and D", () => {
		let form = mount(400);
		let letters = [...form.querySelectorAll("[data-slot=seat-map-letters] > span")].map(
			(cell) => cell.textContent,
		);
		expect(letters).toEqual(["", "A", "B", "C", "", "D", "E", "F", ""]);
		let box = (id: string) => seat(form, id).closest("label")!.getBoundingClientRect();
		let ab = box("11B").left - box("11A").right;
		let cd = box("11D").left - box("11C").right;
		expect(cd).toBeGreaterThan(ab + 10);
		expect(Math.round(box("11A").left)).toBe(Math.round(box("22A").left));
		expect(box("11A").top).toBeLessThan(box("12A").top);
		let number = form.querySelector("[data-row='11'] [data-slot=seat-map-row-number]")!;
		expect(number.textContent).toBe("11");
		expect(number.getBoundingClientRect().left).toBeGreaterThanOrEqual(box("11C").right);
	});

	test("disables taken and blocked seats and leaves the rest pickable", () => {
		let form = mount(400);
		expect(seat(form, "14C").disabled).toBe(true);
		expect(seat(form, "14D").disabled).toBe(true);
		expect(seat(form, "20A").disabled).toBe(true);
		expect(seat(form, "14B").disabled).toBe(false);
		expect(form.querySelectorAll("input[type=radio]:disabled")).toHaveLength(3);
	});

	test("checks the selected seat and posts it under the field name", () => {
		let form = mount(400, "11C");
		expect(seat(form, "11C").checked).toBe(true);
		expect(new FormData(form).get("seat")).toBe("11C");
		seat(form, "15F").click();
		expect(new FormData(form).get("seat")).toBe("15F");
		expect(seat(form, "11C").checked).toBe(false);
	});

	test("posts nothing when no seat is picked and clicking a taken seat changes nothing", () => {
		let form = mount(400);
		expect(new FormData(form).get("seat")).toBeNull();
		seat(form, "14C").closest("label")!.click();
		expect(new FormData(form).get("seat")).toBeNull();
	});

	test("names each seat by its code and its extras", () => {
		let form = mount(400);
		let name = (id: string) => seat(form, id).labels![0]!.textContent;
		expect(name("11A")).toContain("11A, window");
		expect(name("11C")).toContain("11C, aisle");
		expect(name("12F")).toContain("12F, window, exit row");
		expect(name("14C")).toContain(", taken");
		expect(name("10B")).toContain("10B, extra legroom");
		expect(form.querySelector("legend")?.textContent).toBe("Choose a seat");
	});

	test("marks exits on both walls, the wing and the cabin sections", () => {
		let form = mount(400);
		expect(form.querySelectorAll("[data-row='12'] [data-slot=seat-map-wall] svg")).toHaveLength(2);
		expect(form.querySelectorAll("[data-row='11'] [data-slot=seat-map-wall] svg")).toHaveLength(0);
		expect(form.querySelectorAll("[data-wing]")).toHaveLength(6);
		let section = form.querySelector("[data-slot=seat-map-section]")!;
		expect(section.textContent).toBe("Economy");
		expect(section.nextElementSibling?.getAttribute("data-row")).toBe("15");
	});

	test("fits 320px, keeps seats at least 32px wide and scrolls a long cabin in its box", () => {
		let form = mount(320);
		let map = form.querySelector<HTMLElement>("[data-slot=seat-map]")!;
		let cabin = form.querySelector<HTMLElement>("[data-slot=seat-map-cabin]")!;
		expect(map.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(cabin.scrollWidth).toBeLessThanOrEqual(cabin.clientWidth);
		let width = seat(form, "11A").closest("label")!.getBoundingClientRect().width;
		expect(width).toBeGreaterThanOrEqual(32);
		cabin.style.setProperty("--ui-seat-map-max-height", "20rem");
		expect(cabin.clientHeight).toBeLessThanOrEqual(320);
		expect(cabin.scrollHeight).toBeGreaterThan(cabin.clientHeight);
		expect(getComputedStyle(cabin).overflowY).toBe("auto");
	});
});
