/**
 * Lays the board out on a touch screen, in a page that matches `(hover: none)` and
 * `(pointer: coarse)` throughout: buttons inside a column grow their hit areas, and the page
 * still never grows wider than the board's own box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Button } from "../components/button.js";

import { Board } from "./board.js";

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

describe("Board on a touch screen", () => {
	test("a column's buttons keep the page at the viewport's width", () => {
		mounted = render(
			<div style="inline-size: 343px">
				<Board id="touch-board" label="Issues by status">
					{["todo", "started", "review", "done"].map((value) => (
						<Board.Column
							value={value}
							title={value}
							count={0}
							actions={
								<Button type="button" size="sm" aria-label={`Add to ${value}`}>
									+
								</Button>
							}
						/>
					))}
				</Board>
			</div>,
		);
		let columns = mounted.container.querySelector<HTMLElement>('[data-slot="board-columns"]')!;

		expect(columns.scrollWidth).toBeGreaterThan(columns.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});
});
