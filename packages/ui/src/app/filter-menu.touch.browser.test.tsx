/**
 * Opens the filter menu on a touch phone, in a page that matches `(hover: none)` and
 * `(pointer: coarse)` throughout: the popover rests on the bottom edge as a full-width sheet
 * over a dimmed page, and every row is a 44px target.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { run } from "remix/component";
import { renderToString } from "remix/component/server";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { FilterMenu, FilterMenuList } from "./filter-menu.js";

import "../reset.css";
import "../theme.css";

let app: ReturnType<typeof run> | undefined;

beforeAll(async () => {
	await page.viewport(375, 700);
});

afterAll(async () => {
	await page.viewport(414, 896);
});

afterEach(() => {
	app?.dispose();
	app = undefined;
	document.body.replaceChildren();
});

describe("FilterMenu on a touch phone", () => {
	test("opens as a bottom sheet of 44px rows over a dimmed page", async () => {
		document.body.innerHTML = await renderToString(
			<FilterMenu
				id="assignees"
				mode="multiple"
				name="assignee"
				action="/issues/7/assignees"
				trigger="Assignees"
				groups={[
					{
						label: "People",
						items: ["ana", "bo", "cy"].map((value) => ({
							value,
							label: value,
							description: `@${value}`,
							selected: value === "bo",
						})),
					},
				]}
				labels={{
					title: "Assign up to 10 people",
					filter: "Filter people",
					empty: "No one matches",
					more: "{count} more, refine your filter",
					save: "Save",
				}}
			/>,
		);
		app = run({ loadModule: () => FilterMenuList });
		await app.ready();

		expect(matchMedia("(pointer: coarse)").matches).toBe(true);
		await userEvent.click(document.getElementById("assignees-trigger")!);
		let menu = document.getElementById("assignees")!;
		await expect.poll(() => menu.matches(":popover-open")).toBe(true);
		let box = menu.getBoundingClientRect();
		let rows = [...menu.querySelectorAll<HTMLElement>('[data-slot="filter-menu-row"]')];

		expect(box.left).toBe(0);
		expect(box.width).toBe(375);
		expect(Math.round(box.bottom)).toBe(700);
		expect(getComputedStyle(menu, "::backdrop").backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(rows.map((row) => row.getBoundingClientRect().height >= 44)).toEqual([true, true, true]);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);

		await userEvent.click(rows[2]!);
		expect(menu.querySelector<HTMLInputElement>('input[value="cy"]')!.checked).toBe(true);
	});
});
