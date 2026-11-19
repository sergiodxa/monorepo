/**
 * Holds the fulfilment note to its contract in a real browser: each kind draws its own icon
 * beside the words, inline and muted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { FulfilmentNote } from "./fulfilment-note.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("FulfilmentNote", () => {
	test("draws a different icon for each kind beside the words", () => {
		mounted = render(
			<p>
				<FulfilmentNote kind="download">Instant download</FulfilmentNote>
				<FulfilmentNote kind="ships">Ships in 3–5 days</FulfilmentNote>
				<FulfilmentNote kind="pickup">Pick up in store</FulfilmentNote>
			</p>,
		);
		let notes = [
			...mounted.container.querySelectorAll<HTMLElement>('[data-slot="fulfilment-note"]'),
		];
		expect(notes.map((note) => note.dataset.kind)).toEqual(["download", "ships", "pickup"]);
		expect(notes.map((note) => note.textContent)).toEqual([
			"Instant download",
			"Ships in 3–5 days",
			"Pick up in store",
		]);
		let icons = notes.map((note) => note.querySelector("svg")!.innerHTML);
		expect(new Set(icons).size).toBe(3);
		expect(getComputedStyle(notes[0]!).display).toBe("inline-flex");
		expect(notes[0]!.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
	});
});
