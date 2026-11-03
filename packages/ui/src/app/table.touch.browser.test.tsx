/**
 * Lays tables out on a touch screen, in a page that matches `(hover: none)` and
 * `(pointer: coarse)` throughout: row actions show without hover, take their own width, fold
 * into one 44px menu button on a phone and never cover the title or the status.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import {
	accessibleName,
	articles,
	expectOneLineActions,
	intersects,
	lineBoxes,
	MANY_ACTIONS,
	monitors,
	mount,
	OVERLAY_ACTIONS,
	posts,
	shown,
} from "../test/table.js";

import { Table } from "./table.js";

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("Table rows on touch", () => {
	test("always shows row actions where the pointer cannot hover", async () => {
		let host = mount(monitors());

		expect(matchMedia("(hover: none)").matches).toBe(true);
		for (let cell of host.querySelectorAll<HTMLElement>('[data-slot="row-actions"]')) {
			expect(getComputedStyle(cell).opacity).toBe("1");
		}
	});
});

describe("Table row actions on touch", () => {
	test("stay inline and take their width where the pointer cannot hover", async () => {
		await page.viewport(1024, 768);
		let host = mount(posts({ actions: MANY_ACTIONS }), 1024);

		expect(matchMedia("(hover: none)").matches).toBe(true);
		expectOneLineActions(host, MANY_ACTIONS);
		for (let cell of host.querySelectorAll<HTMLElement>('tbody [data-slot="row-actions"]')) {
			let actions = [...cell.querySelectorAll<HTMLElement>("a")];
			expect(cell.getBoundingClientRect().width).toBeGreaterThanOrEqual(
				actions.at(-1)!.getBoundingClientRect().right - actions[0]!.getBoundingClientRect().left,
			);
			expect(getComputedStyle(cell).opacity).toBe("1");
		}
	});

	for (let actions of [false, true]) {
		let kind = actions ? "Table.Action" : "LinkButton";
		test(`shows one 44px menu button without hover on a 375px touch screen, holding every ${kind} action`, async () => {
			await page.viewport(375, 812);
			let host = mount(articles({ actions }), 375);
			let cell = host.querySelector<HTMLElement>('tbody [data-slot="row-actions"]')!;

			expect(matchMedia("(hover: none)").matches).toBe(true);
			expect(getComputedStyle(cell).opacity).toBe("1");
			let visible = shown(cell);
			expect(visible).toHaveLength(1);
			let more = visible[0]!;
			expect(accessibleName(more)).not.toBe("");
			let box = more.getBoundingClientRect();
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);

			await userEvent.click(more);
			let menu = document.getElementById(more.getAttribute("commandfor")!)!;
			await expect.poll(() => menu.matches(":popover-open")).toBe(true);
			let items = shown(menu);
			expect(items.map((item) => item.textContent)).toEqual(OVERLAY_ACTIONS);
			let danger = '[data-danger], [data-color="danger"]';
			expect(items.map((item) => item.matches(danger))).toEqual([false, false, true]);
			for (let item of items) expect(lineBoxes(item)).toBe(1);
		});
	}

	test("shows no menu button in a row with no actions", async () => {
		await page.viewport(375, 812);
		let host = mount(
			<Table.Container>
				<Table aria-label="Teams">
					<Table.Header>
						<Table.Row>
							<Table.Column>Team</Table.Column>
							<Table.ActionsColumn label="Actions" />
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<Table.Row>
							<Table.Cell>Owners</Table.Cell>
							<Table.Actions>{false}</Table.Actions>
						</Table.Row>
					</Table.Body>
				</Table>
			</Table.Container>,
			375,
		);

		expect(shown(host.querySelector('tbody [data-slot="row-actions"]')!)).toHaveLength(0);
	});

	test(`never lays the actions over the title or status on a 375px touch screen`, async () => {
		await page.viewport(375, 812);
		let host = mount(articles(), 375);

		for (let row of host.querySelectorAll<HTMLElement>("tbody tr")) {
			row.querySelector<HTMLElement>('[data-slot="row-link"]')!.focus();
			let cell = row.querySelector<HTMLElement>('[data-slot="row-actions"]')!;
			await expect.poll(() => getComputedStyle(cell).opacity).toBe("1");
			let title = row.children[0]!.getBoundingClientRect();
			let status = row.querySelector('[data-type="status"]')!.getBoundingClientRect();
			let parts = [cell, ...cell.querySelectorAll<HTMLElement>("*")].filter(
				(part) => part.getClientRects().length > 0 && !part.closest(":popover-open, dialog"),
			);
			for (let part of parts) {
				let box = part.getBoundingClientRect();
				expect(intersects(box, title)).toBe(false);
				expect(intersects(box, status)).toBe(false);
			}
		}
	});
});
