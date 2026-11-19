/**
 * Renders `BoardingPass` and `PassCode` in a real browser: the code art is the same for the same
 * data and differs for other data, it carries three finder squares and a spoken name, every field
 * shows under its caption, and the pass fits a 320px column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { BoardingPass, PassCode } from "./boarding-pass.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult[] = [];

afterEach(() => {
	for (let result of mounted) result.cleanup();
	mounted = [];
	document.body.replaceChildren();
});

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 400): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted.push(render(node, { container: host }));
	return host;
}

/** The path data of the code art drawn for `code`. */
function modules(code: string): string {
	let host = mount(<PassCode code={code} label={`Code ${code}`} />);
	return host.querySelector("[data-slot=pass-code-modules]")?.getAttribute("d") ?? "";
}

/** A pass from Marrow Bay to Vellis in a host `width` pixels wide. */
function pass(width: number): HTMLElement {
	return mount(
		<BoardingPass
			label="Boarding pass, MRW to VLS"
			airline={{ name: "Larkwing Air", mark: <svg viewBox="0 0 10 10" /> }}
			passenger="Ana Ortiz"
			from={{ code: "MRW", city: "Marrow Bay", time: "08:40" }}
			to={{ code: "VLS", city: "Vellis", time: "11:05" }}
			flight="LK 482"
			date="14 Mar"
			gate="B12"
			boards="08:05"
			seat="14C"
			zone="3"
			cabin="Economy"
			confirmation="K7Q2XR"
			code="LK482|K7Q2XR|14C"
			labels={{
				passenger: "Passenger",
				flight: "Flight",
				date: "Date",
				gate: "Gate",
				boards: "Boards",
				seat: "Seat",
				zone: "Zone",
				cabin: "Cabin",
				confirmation: "Confirmation",
				from: "From",
				to: "To",
				code: "Boarding code for confirmation K7Q2XR",
			}}
		/>,
		width,
	);
}

describe("PassCode", () => {
	test("draws the same pattern for the same data and another for other data", () => {
		let first = modules("LK482|K7Q2XR|14C");
		expect(first.length).toBeGreaterThan(100);
		expect(modules("LK482|K7Q2XR|14C")).toBe(first);
		expect(modules("LK482|K7Q2XR|14D")).not.toBe(first);
	});

	test("carries three finder squares in the corners and names the image", () => {
		let host = mount(<PassCode code="ABC" label="Boarding code for confirmation ABC" />);
		let svg = host.querySelector("svg")!;
		expect(svg.getAttribute("role")).toBe("img");
		expect(svg.getAttribute("aria-label")).toBe("Boarding code for confirmation ABC");
		let finders = [...svg.querySelectorAll("[data-slot=pass-code-finder]")].map((finder) =>
			finder.getAttribute("transform"),
		);
		expect(finders).toEqual(["translate(2 2)", "translate(20 2)", "translate(2 20)"]);
		let box = svg.getBoundingClientRect();
		expect(Math.round(box.width)).toBe(Math.round(box.height));
	});
});

describe("BoardingPass", () => {
	test("is an article named by its label showing every field under its caption", () => {
		let host = pass(400);
		let article = host.querySelector("article")!;
		expect(article.getAttribute("aria-label")).toBe("Boarding pass, MRW to VLS");
		let fields = Object.fromEntries(
			[...article.querySelectorAll("[data-field]")].map((field) => [
				field.querySelector("dt")?.textContent,
				field.querySelector("dd")?.textContent,
			]),
		);
		expect(fields).toEqual({
			Passenger: "Ana Ortiz",
			Flight: "LK 482",
			Date: "14 Mar",
			Boards: "08:05",
			Gate: "B12",
			Seat: "14C",
			Zone: "3",
			Cabin: "Economy",
			Confirmation: "K7Q2XR",
		});
		expect(article.querySelector("[data-slot=boarding-pass-airline]")?.textContent).toBe(
			"Larkwing Air",
		);
		expect(article.querySelector("[data-slot=boarding-pass-from]")?.textContent).toBe(
			"From MRWMarrow Bay08:40",
		);
		expect(article.querySelector("[data-slot=boarding-pass-to]")?.textContent).toBe(
			"To VLSVellis11:05",
		);
		expect(article.querySelector("svg[role=img]")?.getAttribute("aria-label")).toBe(
			"Boarding code for confirmation K7Q2XR",
		);
	});

	test("sets the codes either side of the plane and the tear between the parts", () => {
		let host = pass(400);
		let from = host.querySelector("[data-slot=boarding-pass-from]")!.getBoundingClientRect();
		let plane = host.querySelector("[data-slot=boarding-pass-plane]")!.getBoundingClientRect();
		let to = host.querySelector("[data-slot=boarding-pass-to]")!.getBoundingClientRect();
		expect(from.right).toBeLessThanOrEqual(plane.left);
		expect(plane.right).toBeLessThanOrEqual(to.left);
		let main = host.querySelector("[data-slot=boarding-pass-main]")!.getBoundingClientRect();
		let tear = host.querySelector("[data-slot=boarding-pass-tear]")!.getBoundingClientRect();
		let code = host.querySelector("svg[role=img]")!.getBoundingClientRect();
		expect(tear.top).toBeGreaterThanOrEqual(main.bottom - 0.5);
		expect(code.top).toBeGreaterThan(tear.top);
	});

	test("fits a 320px column without overflowing", () => {
		let host = pass(320);
		let article = host.querySelector<HTMLElement>("article")!;
		expect(article.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(article.scrollWidth).toBeLessThanOrEqual(320);
		for (let field of article.querySelectorAll("[data-field]")) {
			expect(field.getBoundingClientRect().right).toBeLessThanOrEqual(
				article.getBoundingClientRect().right + 0.5,
			);
		}
	});
});
