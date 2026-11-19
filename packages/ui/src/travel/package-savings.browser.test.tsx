/**
 * Renders `PackageSavings` in a real browser: every part's separate price is struck through and
 * led by hidden words, the bundled price and the saving badge read beside the struck total, the
 * summary moves beside the parts when wide, and the bundle fits 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { PackageSavings } from "./package-savings.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a flight, stay and car bundle `width` pixels wide and returns its section. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<PackageSavings
			title="Flight + Hotel + Car"
			savings="You save $212"
			bundleLabel="Package price"
			bundlePrice="$1,486"
			bundleDetail="2 travellers · taxes included"
			separateTotal="$1,698"
			separateLabel="Booked separately"
			action={<button type="button">Book package</button>}
		>
			<PackageSavings.Part
				kind="flight"
				label="Return flights MRW ⇄ VLS"
				detail="Larkwing Air · Economy"
				price="$684"
			/>
			<PackageSavings.Part
				kind="stay"
				label="5 nights at Hotel Saltmarsh"
				detail="Double room · breakfast"
				price="$824"
			/>
			<PackageSavings.Part
				kind="car"
				label="Compact car, 5 days"
				detail="Tallow Rent"
				price="$190"
			/>
		</PackageSavings>,
		{ container: host },
	);
	return host.querySelector("section")!;
}

describe("PackageSavings", () => {
	test("strikes every separate price through and leads it with hidden words", () => {
		let section = mount(640);
		let parts = [...section.querySelectorAll("[data-slot=package-savings-part]")];
		expect(parts.map((part) => part.querySelector("s")?.textContent)).toEqual([
			"$684",
			"$824",
			"$190",
		]);
		expect(parts[0]!.textContent).toContain("Booked separately: $684");
		expect(getComputedStyle(parts[0]!.querySelector("s")!).textDecorationLine).toBe("line-through");
	});

	test("reads the struck total, the bundled price and the saving together", () => {
		let section = mount(640);
		let bundle = section.querySelector("[data-slot=package-savings-bundle]")!;
		expect(bundle.querySelector("s")?.textContent).toBe("$1,698");
		expect(bundle.querySelector("output")?.textContent).toBe("$1,486");
		expect(bundle.querySelector("[data-slot=package-savings-badge]")?.textContent).toBe(
			"You save $212",
		);
	});

	test("hides each part's icon from assistive technology", () => {
		let section = mount(640);
		for (let part of section.querySelectorAll("[data-slot=package-savings-part]")) {
			expect(part.querySelector("svg")?.closest("[aria-hidden=true]")).not.toBeNull();
		}
	});

	test("puts the bundle under the parts when narrow and beside them when wide", () => {
		let narrow = mount(380);
		let parts = narrow.querySelector("[data-slot=package-savings-parts]")!.getBoundingClientRect();
		let bundle = narrow
			.querySelector("[data-slot=package-savings-bundle]")!
			.getBoundingClientRect();
		expect(bundle.top).toBeGreaterThanOrEqual(parts.bottom);
		mounted?.cleanup();
		document.body.replaceChildren();

		let wide = mount(720);
		parts = wide.querySelector("[data-slot=package-savings-parts]")!.getBoundingClientRect();
		bundle = wide.querySelector("[data-slot=package-savings-bundle]")!.getBoundingClientRect();
		expect(bundle.left).toBeGreaterThanOrEqual(parts.right);
	});

	test("fits a 320px column without overflowing", () => {
		let section = mount(320);
		expect(section.scrollWidth).toBeLessThanOrEqual(320);
		let right = section.getBoundingClientRect().right + 0.5;
		for (let part of section.querySelectorAll("[data-slot]")) {
			expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(right);
		}
	});
});
