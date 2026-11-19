/**
 * Holds the star picker to its contract in a real browser: one radio per label in score
 * order, the picked star and every earlier one filled, hovering previewing a score, and the
 * arrow keys stepping along the scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { RatingInput } from "./rating-input.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

/** One name per star. */
const LABELS = [
	"1 star — Poor",
	"2 stars — Fair",
	"3 stars — Good",
	"4 stars — Great",
	"5 stars — Excellent",
];

/** The palette steps the stars paint with, which an app defines and a test stands in for. */
const PALETTE = {
	"--ui-color-warning-600": "rgb(217, 119, 6)",
	"--ui-color-neutral-600": "rgb(82, 82, 91)",
	"--ui-color-neutral-400": "rgb(161, 161, 170)",
};

let mounted: RenderResult | undefined;

beforeAll(() => {
	for (let [name, value] of Object.entries(PALETTE)) {
		document.documentElement.style.setProperty(name, value);
	}
});

afterAll(() => {
	for (let name of Object.keys(PALETTE)) document.documentElement.style.removeProperty(name);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Each star's painted colour, lowest first. */
function colors(root: HTMLElement): string[] {
	return [...root.querySelectorAll<HTMLElement>("label")].map(
		(label) => getComputedStyle(label).color,
	);
}

/** Which stars read as filled, lowest first, against the colour of the last star. */
function filled(root: HTMLElement, empty: string): boolean[] {
	return colors(root).map((color) => color !== empty);
}

/** Waits until a check passes, for a colour that eases between stars. */
async function until(check: () => boolean, timeout = 1000): Promise<void> {
	let start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

/** Whether the stars read filled exactly as `expected`, lowest first. */
function reads(root: HTMLElement, empty: string, expected: boolean[]): boolean {
	return filled(root, empty).join() === expected.join();
}

describe("RatingInput", () => {
	test("renders one named radio per label in score order inside a fieldset", () => {
		mounted = render(<RatingInput name="rating" legend="Your rating" required labels={LABELS} />);
		let fieldset = mounted.container.querySelector("fieldset")!;
		expect(fieldset.querySelector("legend")!.textContent).toBe("Your rating");
		let radios = [...fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
		expect(radios.map((radio) => radio.value)).toEqual(["1", "2", "3", "4", "5"]);
		expect(radios.every((radio) => radio.name === "rating" && radio.required)).toBe(true);
		expect(radios[2]!.labels![0]!.textContent).toBe("3 stars — Good");
	});

	test("fills the picked star and every earlier one, and previews on hover", async () => {
		mounted = render(<RatingInput name="rating" legend="Your rating" value={2} labels={LABELS} />);
		let root = mounted.container;
		let empty = colors(root)[4]!;
		expect(filled(root, empty)).toEqual([true, true, false, false, false]);
		let labels = root.querySelectorAll<HTMLElement>("label");
		await userEvent.click(labels[3]!);
		expect(root.querySelector<HTMLInputElement>("input:checked")!.value).toBe("4");
		await until(() => reads(root, empty, [true, true, true, true, false]));
		await userEvent.hover(labels[0]!);
		await until(() => reads(root, empty, [true, false, false, false, false]));
		await userEvent.unhover(labels[0]!);
		await until(() => reads(root, empty, [true, true, true, true, false]));
	});

	test("steps up the scale with the arrow keys", async () => {
		mounted = render(<RatingInput name="rating" legend="Your rating" value={3} labels={LABELS} />);
		let checked = mounted.container.querySelector<HTMLInputElement>("input:checked")!;
		checked.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(mounted.container.querySelector<HTMLInputElement>("input:checked")!.value).toBe("4");
	});
});
