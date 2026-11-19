/**
 * Renders `FareOptions` in a real browser: the cards are radios in a named group that post
 * the chosen value with no script, every feature is heard with its status, the chosen card
 * is drawn apart, and the cards stack narrow, sit side by side wide and fit 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { FareOptions } from "./fare-options.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts three fares inside a form `width` pixels wide and returns the form. */
function mount(width: number): HTMLFormElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<form>
			<FareOptions
				legend="Choose your fare"
				name="fare"
				statusLabels={{ yes: "Included", no: "Not included", fee: "Available for a fee" }}
			>
				<FareOptions.Option
					value="basic"
					title="Basic"
					price="$412"
					features={[
						{ label: "Personal item", included: "yes" },
						{ label: "Carry-on bag", included: "fee" },
						{ label: "Changes", included: "no" },
					]}
				/>
				<FareOptions.Option
					value="standard"
					title="Standard"
					price="$468"
					priceDetail="+$56"
					ribbon="Recommended"
					checked
					features={[{ label: "Carry-on bag", included: "yes" }]}
				/>
				<FareOptions.Option
					value="flex"
					title="Flex"
					price="$544"
					priceDetail="+$132"
					features={[{ label: "Free changes", included: "yes" }]}
				/>
			</FareOptions>
		</form>,
		{ container: host },
	);
	return host.querySelector("form")!;
}

describe("FareOptions", () => {
	test("is a fieldset named by its legend, a radio per fare", () => {
		let form = mount(640);
		let fieldset = form.querySelector("fieldset")!;
		expect(fieldset.querySelector("legend")?.textContent).toBe("Choose your fare");
		let radios = [...fieldset.querySelectorAll<HTMLInputElement>("input[type=radio]")];
		expect(radios.map((radio) => radio.name)).toEqual(["fare", "fare", "fare"]);
		expect(radios.map((radio) => radio.value)).toEqual(["basic", "standard", "flex"]);
	});

	test("names each radio by its title and describes it by price and features", () => {
		let form = mount(640);
		let radio = form.querySelector<HTMLInputElement>("input[value=basic]")!;
		expect(document.getElementById(radio.getAttribute("aria-labelledby")!)?.textContent).toBe(
			"Basic",
		);
		let description = document.getElementById(radio.getAttribute("aria-describedby")!)!;
		expect(description.textContent).toContain("$412");
		expect(description.textContent).toContain("Available for a fee: Carry-on bag");
		expect(description.textContent).toContain("Not included: Changes");
	});

	test("posts the checked fare and changes it by clicking a card, with no script", () => {
		let form = mount(640);
		expect(new FormData(form).get("fare")).toBe("standard");
		form
			.querySelector<HTMLElement>(
				"[data-slot=fare-option]:last-child [data-slot=fare-option-price]",
			)!
			.click();
		expect(new FormData(form).get("fare")).toBe("flex");
	});

	test("draws the chosen card apart from the rest", () => {
		let form = mount(640);
		let [basic, standard] = form.querySelectorAll<HTMLElement>("[data-slot=fare-option]");
		expect(getComputedStyle(standard!).boxShadow).not.toBe(getComputedStyle(basic!).boxShadow);
		expect(standard!.querySelector("[data-slot=fare-option-ribbon]")?.textContent).toBe(
			"Recommended",
		);
	});

	test("draws a check, cross or coin for each feature, hidden from assistive technology", () => {
		let form = mount(640);
		let features = [...form.querySelectorAll<HTMLElement>("[data-slot=fare-option-feature]")];
		expect(features.slice(0, 3).map((feature) => feature.dataset.included)).toEqual([
			"yes",
			"fee",
			"no",
		]);
		for (let feature of features) {
			expect(feature.querySelector("svg")?.closest("[aria-hidden=true]")).not.toBeNull();
		}
	});

	test("stacks the cards when narrow and sets them side by side when wide", () => {
		let narrow = mount(400);
		let cards = [...narrow.querySelectorAll("[data-slot=fare-option]")].map((card) =>
			card.getBoundingClientRect(),
		);
		expect(cards[1]!.top).toBeGreaterThan(cards[0]!.bottom);
		mounted?.cleanup();
		document.body.replaceChildren();

		let wide = mount(720);
		cards = [...wide.querySelectorAll("[data-slot=fare-option]")].map((card) =>
			card.getBoundingClientRect(),
		);
		expect(cards[1]!.left).toBeGreaterThan(cards[0]!.right);
		expect(Math.round(cards[0]!.width)).toBe(Math.round(cards[2]!.width));
	});

	test("fits a 320px column without overflowing", () => {
		let form = mount(320);
		let fieldset = form.querySelector("fieldset")!;
		expect(fieldset.scrollWidth).toBeLessThanOrEqual(320);
		expect(fieldset.getBoundingClientRect().width).toBeLessThanOrEqual(320);
	});
});
