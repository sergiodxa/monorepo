/**
 * Holds the pager's item run to the shape a reader expects: both ends always present,
 * a window around the current page, and a gap only where pages were actually left out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { pageWindow } from "~/app/services/page-window";

describe("pageWindow", () => {
	test("keeps a short run whole", () => {
		expect(pageWindow(3, 5).map((item) => (item.kind === "page" ? item.page : "…"))).toEqual([
			1, 2, 3, 4, 5,
		]);
	});

	test("opens a gap on both sides of a middle page", () => {
		expect(pageWindow(6, 12).map((item) => (item.kind === "page" ? item.page : "…"))).toEqual([
			1,
			"…",
			5,
			6,
			7,
			"…",
			12,
		]);
	});

	test("opens no gap next to the page it adjoins", () => {
		expect(pageWindow(2, 12).map((item) => (item.kind === "page" ? item.page : "…"))).toEqual([
			1,
			2,
			3,
			"…",
			12,
		]);
	});
});
