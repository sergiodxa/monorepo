/**
 * Draws label chips in a real browser: a pill's text clears 4.5:1 against its own tint for
 * every hue and for extreme colours in light and dark, a hue stands in for a colour, and the
 * dot variant keeps neutral text with the colour in a hidden dot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { LabelChip } from "./label-chip.js";

import "../reset.css";
import "../theme.css";

/** Every 30° of the wheel, as a hue a label could carry. */
const HUES = Array.from({ length: 12 }, (_, index) => index * 30);

/** Colours people pick for labels that stress a derived text colour the most. */
const COLORS = ["#ffff00", "#ffffff", "#000000", "#00ff00", "#0000ff", "#d73a4a", "#808080"];

/** Mounts `node` in a fresh host appended to the page and returns the first chip in it. */
function mount(node: JSX.Element): HTMLElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	render(node, { container: host });
	return host.querySelector<HTMLElement>('[data-slot="label-chip"]')!;
}

/** The relative luminance of a CSS colour, read back as painted on a canvas. */
function luminance(color: string): number {
	let canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	let context = canvas.getContext("2d")!;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	let [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map((channel) => {
		let c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast between a chip's text and its own background. */
function contrastOf(chip: HTMLElement): number {
	let style = getComputedStyle(chip);
	let [a, z] = [luminance(style.color), luminance(style.backgroundColor)];
	return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05);
}

afterEach(() => {
	document.body.replaceChildren();
	document.documentElement.classList.remove("dark");
});

describe("LabelChip", () => {
	for (let scheme of ["light", "dark"] as const) {
		test(`keeps a pill's text at 4.5:1 or better on its tint for every hue, in ${scheme}`, () => {
			if (scheme === "dark") document.documentElement.classList.add("dark");
			for (let hue of HUES) {
				let chip = mount(<LabelChip hue={hue}>Label</LabelChip>);
				expect(contrastOf(chip), `hue ${hue}`).toBeGreaterThanOrEqual(4.5);
			}
		});

		test(`keeps a pill's text at 4.5:1 or better for extreme colours, in ${scheme}`, () => {
			if (scheme === "dark") document.documentElement.classList.add("dark");
			for (let color of COLORS) {
				let chip = mount(<LabelChip color={color}>Label</LabelChip>);
				expect(contrastOf(chip), color).toBeGreaterThanOrEqual(4.5);
			}
		});
	}

	test("tints a pill differently in light and dark", () => {
		let light = getComputedStyle(mount(<LabelChip hue={25}>Bug</LabelChip>)).backgroundColor;
		document.documentElement.classList.add("dark");
		let dark = getComputedStyle(mount(<LabelChip hue={25}>Bug</LabelChip>)).backgroundColor;

		expect(luminance(light)).toBeGreaterThan(0.7);
		expect(luminance(dark)).toBeLessThan(0.1);
	});

	test("derives a pill from its colour, so two hues draw two tints", () => {
		let red = getComputedStyle(mount(<LabelChip color="#d73a4a">bug</LabelChip>));
		let green = getComputedStyle(mount(<LabelChip color="#0e8a16">ok</LabelChip>));

		expect(red.backgroundColor).not.toBe(green.backgroundColor);
		expect(red.color).not.toBe(green.color);
	});

	test("draws the dot variant with neutral text and the colour in a hidden dot", () => {
		let chip = mount(
			<LabelChip variant="dot" color="rgb(200, 0, 0)">
				Bug
			</LabelChip>,
		);
		let dot = chip.querySelector<HTMLElement>('[data-slot="label-chip-dot"]')!;

		expect(chip.dataset.variant).toBe("dot");
		expect(chip.textContent).toBe("Bug");
		expect(dot.getAttribute("aria-hidden")).toBe("true");
		expect(getComputedStyle(dot).backgroundColor).toBe("rgb(200, 0, 0)");
		expect(getComputedStyle(dot).inlineSize).toBe("8px");
		expect(getComputedStyle(chip).backgroundColor).toBe("rgba(0, 0, 0, 0)");
	});

	test("draws no dot on a pill, and keeps a style it was given", () => {
		let chip = mount(
			<LabelChip color="#d73a4a" style={{ "margin-inline-start": "3px" }}>
				bug
			</LabelChip>,
		);

		expect(chip.querySelector('[data-slot="label-chip-dot"]')).toBeNull();
		expect(chip.dataset.variant).toBe("pill");
		expect(getComputedStyle(chip).marginInlineStart).toBe("3px");
		expect(chip.style.getPropertyValue("--ui-label-chip-color")).toBe("#d73a4a");
	});

	test("stands a hue in for a mid-tone colour, and greys a label with neither", () => {
		let hued = mount(<LabelChip hue={150}>Feature</LabelChip>);
		let plain = mount(<LabelChip>Other</LabelChip>);

		expect(hued.style.getPropertyValue("--ui-label-chip-color")).toBe("oklch(0.62 0.15 150)");
		expect(plain.style.getPropertyValue("--ui-label-chip-color")).toBe("oklch(0.62 0 0)");
	});

	test("stays one line tall however long the name", () => {
		let chip = mount(<LabelChip hue={245}>A rather long label name that would wrap</LabelChip>);

		expect(chip.getBoundingClientRect().height).toBe(20);
	});
});
