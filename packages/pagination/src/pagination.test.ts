/**
 * Tests for the `Pagination` value object.
 *
 * The arithmetic is what every list and every API envelope reads, so the boundaries
 * are pinned here: a page past the end, an empty result, a single page, and the last
 * partial page, plus the `toJSON()` that keeps an instance from serializing as `{}`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { Pagination } from "./pagination";

describe("Pagination", () => {
	test("derives every value from page, perPage, and total", () => {
		let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });

		expect(pagination.page).toBe(3);
		expect(pagination.perPage).toBe(25);
		expect(pagination.total).toBe(892);
		expect(pagination.pages).toBe(36);
		expect(pagination.offset).toBe(50);
		expect(pagination.limit).toBe(25);
		expect(pagination.from).toBe(51);
		expect(pagination.to).toBe(75);
		expect(pagination.hasPrev).toBe(true);
		expect(pagination.hasNext).toBe(true);
		expect(pagination.prev).toBe(2);
		expect(pagination.next).toBe(4);
	});

	test("clamps a page past the end down to the last page", () => {
		let pagination = new Pagination({ page: 500, perPage: 25, total: 892 });

		expect(pagination.page).toBe(36);
		expect(pagination.offset).toBe(875);
		expect(pagination.from).toBe(876);
		expect(pagination.to).toBe(892);
		expect(pagination.hasNext).toBe(false);
		expect(pagination.next).toBeNull();
		expect(pagination.prev).toBe(35);
	});

	test("clamps a page below the first page up to 1", () => {
		let pagination = new Pagination({ page: 0, perPage: 25, total: 892 });

		expect(pagination.page).toBe(1);
		expect(pagination.offset).toBe(0);
		expect(pagination.hasPrev).toBe(false);
		expect(pagination.prev).toBeNull();
	});

	test("normalizes non-finite and fractional input", () => {
		expect(new Pagination({ page: Number.NaN, perPage: 25, total: 100 }).page).toBe(1);
		expect(new Pagination({ page: 2.7, perPage: 25, total: 100 }).page).toBe(2);
		expect(new Pagination({ page: 1, perPage: 0, total: 100 }).perPage).toBe(1);
		expect(new Pagination({ page: 1, perPage: 25, total: -5 }).total).toBe(0);
	});

	test("reports one empty page for a zero total", () => {
		let pagination = new Pagination({ page: 4, perPage: 25, total: 0 });

		expect(pagination.pages).toBe(1);
		expect(pagination.page).toBe(1);
		expect(pagination.offset).toBe(0);
		expect(pagination.from).toBe(0);
		expect(pagination.to).toBe(0);
		expect(pagination.hasPrev).toBe(false);
		expect(pagination.hasNext).toBe(false);
		expect(pagination.prev).toBeNull();
		expect(pagination.next).toBeNull();
	});

	test("has neither neighbour when everything fits on one page", () => {
		let pagination = new Pagination({ page: 1, perPage: 25, total: 25 });

		expect(pagination.pages).toBe(1);
		expect(pagination.from).toBe(1);
		expect(pagination.to).toBe(25);
		expect(pagination.hasPrev).toBe(false);
		expect(pagination.hasNext).toBe(false);
	});

	test("stops `to` at the total on a partial last page", () => {
		let pagination = new Pagination({ page: 3, perPage: 10, total: 24 });

		expect(pagination.pages).toBe(3);
		expect(pagination.offset).toBe(20);
		expect(pagination.from).toBe(21);
		expect(pagination.to).toBe(24);
		expect(pagination.hasNext).toBe(false);
	});

	test("is frozen, so a page change means a new instance", () => {
		let pagination = new Pagination({ page: 1, perPage: 25, total: 100 });

		expect(Object.isFrozen(pagination)).toBe(true);
	});

	describe("series()", () => {
		test("keeps the first and last pages and elides the rest", () => {
			let series = new Pagination({ page: 3, perPage: 25, total: 892 }).series();

			expect(series).toEqual([
				{ type: "page", page: 1, current: false },
				{ type: "page", page: 2, current: false },
				{ type: "page", page: 3, current: true },
				{ type: "page", page: 4, current: false },
				{ type: "gap" },
				{ type: "page", page: 36, current: false },
			]);
		});

		test("places a gap on both sides of a middle page", () => {
			let series = new Pagination({ page: 18, perPage: 25, total: 892 }).series();

			expect(series).toEqual([
				{ type: "page", page: 1, current: false },
				{ type: "gap" },
				{ type: "page", page: 17, current: false },
				{ type: "page", page: 18, current: true },
				{ type: "page", page: 19, current: false },
				{ type: "gap" },
				{ type: "page", page: 36, current: false },
			]);
		});

		test("emits no gap between consecutive page numbers", () => {
			let series = new Pagination({ page: 2, perPage: 10, total: 40 }).series();

			expect(series).toEqual([
				{ type: "page", page: 1, current: false },
				{ type: "page", page: 2, current: true },
				{ type: "page", page: 3, current: false },
				{ type: "page", page: 4, current: false },
			]);
		});

		test("narrows the range when asked for a smaller window", () => {
			let series = new Pagination({ page: 18, perPage: 25, total: 892 }).series({ window: 0 });

			expect(series).toEqual([
				{ type: "page", page: 1, current: false },
				{ type: "gap" },
				{ type: "page", page: 18, current: true },
				{ type: "gap" },
				{ type: "page", page: 36, current: false },
			]);
		});

		test("widens the range when asked for a larger window", () => {
			let series = new Pagination({ page: 18, perPage: 25, total: 892 }).series({ window: 3 });

			expect(series.filter((item) => item.type === "page").map((item) => item.page)).toEqual([
				1, 15, 16, 17, 18, 19, 20, 21, 36,
			]);
		});

		test("marks only the current page, at either edge of the range", () => {
			let last = new Pagination({ page: 36, perPage: 25, total: 892 }).series();

			expect(last).toEqual([
				{ type: "page", page: 1, current: false },
				{ type: "gap" },
				{ type: "page", page: 35, current: false },
				{ type: "page", page: 36, current: true },
			]);
		});

		test("is a single current page when there is only one", () => {
			expect(new Pagination({ page: 1, perPage: 25, total: 0 }).series()).toEqual([
				{ type: "page", page: 1, current: true },
			]);
		});
	});

	describe("toJSON()", () => {
		test("round-trips through JSON.stringify instead of serializing as {}", () => {
			let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });
			let round = JSON.parse(JSON.stringify(pagination)) as unknown;

			expect(round).toEqual({
				page: 3,
				perPage: 25,
				total: 892,
				pages: 36,
				offset: 50,
				limit: 25,
				from: 51,
				to: 75,
				hasPrev: true,
				hasNext: true,
				prev: 2,
				next: 4,
			});
		});

		test("serializes inside an envelope, where a spread would see nothing", () => {
			let pagination = new Pagination({ page: 1, perPage: 10, total: 5 });

			expect(JSON.stringify({ meta: pagination })).toContain('"pages":1');
			// oxlint-disable-next-line typescript/no-misused-spread -- Losing the prototype is the behavior under test: every field is a getter, so a spread copies none of them and callers must serialize instead.
			expect(Object.keys({ ...pagination })).toEqual([]);
		});

		test("keeps nulls for the missing neighbours", () => {
			let json = new Pagination({ page: 1, perPage: 10, total: 5 }).toJSON();

			expect(json.prev).toBeNull();
			expect(json.next).toBeNull();
		});
	});
});
