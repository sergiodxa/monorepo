/**
 * Lays buttons out on a touch screen, in a page that matches `(hover: none)` and
 * `(pointer: coarse)` throughout: a button's enlarged hit area stays inside the scrolling
 * row it sits in, so a row wider than the phone scrolls on its own and the page never widens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Button } from "./button.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

beforeAll(async () => {
	await page.viewport(375, 700);
});

afterAll(async () => {
	await page.viewport(414, 896);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("Button on a touch screen", () => {
	test("a scrolling row of small buttons keeps the page at the viewport's width", () => {
		mounted = render(
			<div style="inline-size: 343px; overflow-x: auto; display: flex; gap: 280px">
				{["One", "Two", "Three", "Four"].map((label) => (
					<Button type="button" size="sm" aria-label={label}>
						+
					</Button>
				))}
			</div>,
		);
		let row = mounted.container.firstElementChild as HTMLElement;

		expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("the hit area still reaches the target size around a small button", () => {
		mounted = render(
			<div style="padding: 40px">
				<Button type="button" size="sm" aria-label="Add">
					+
				</Button>
			</div>,
		);
		let button = mounted.container.querySelector("button")!;
		let after = getComputedStyle(button, "::after");

		expect(after.position).toBe("absolute");
		expect(Number.parseFloat(after.inlineSize)).toBeGreaterThanOrEqual(44);
		expect(getComputedStyle(button).position).toBe("relative");
	});
});
