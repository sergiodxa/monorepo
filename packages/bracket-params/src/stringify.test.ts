/**
 * Tests for the writers: the bracket keys they write, how each leaf type serializes, the files
 * `toFormData` appends, and the round trip back through `parse`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { parse, stringify, toFormData } from "./index.js";

/**
 * Writes a value and decodes the result, so assertions read the keys unescaped.
 *
 * @param value - The value to write
 * @returns The decoded query string
 */
function written(value: Parameters<typeof stringify>[0]): string {
	return decodeURIComponent(stringify(value).replaceAll("+", " "));
}

describe("keys", () => {
	test("writes nested objects and arrays with brackets", () => {
		expect(written({ a: { b: { c: "1" } } })).toBe("a[b][c]=1");
		expect(written({ a: ["x", "y"] })).toBe("a[0]=x&a[1]=y");
		expect(written({ a: [{ b: "1", c: "2" }, { b: "3" }] })).toBe("a[0][b]=1&a[0][c]=2&a[1][b]=3");
	});

	test("encodes like URLSearchParams", () => {
		expect(stringify({ a: { b: "hello world" }, c: "é&=" })).toBe(
			"a%5Bb%5D=hello+world&c=%C3%A9%26%3D",
		);
	});

	test("returns a string URLSearchParams reads back", () => {
		let params = new URLSearchParams(stringify({ page: 2, filter: { status: "open" } }));
		expect([...params]).toEqual([
			["page", "2"],
			["filter[status]", "open"],
		]);
	});

	test("writes an empty object as an empty string", () => {
		expect(stringify({})).toBe("");
	});
});

describe("leaves", () => {
	test("writes primitives with String()", () => {
		expect(written({ n: 1.5, t: true, f: false, b: 10n, s: "" })).toBe(
			"n=1.5&t=true&f=false&b=10&s=",
		);
	});

	test("writes a Date as its ISO string", () => {
		expect(written({ at: new Date("2026-09-30T12:00:00Z") })).toBe("at=2026-09-30T12:00:00.000Z");
	});

	test("skips null, undefined and empty groups", () => {
		expect(written({ a: null, b: undefined, c: [], d: {}, e: "1" })).toBe("e=1");
		expect(written({ a: [null, "x"] })).toBe("a[1]=x");
	});

	test("accepts values typed by an interface", () => {
		interface Filters {
			status: string;
			tags: string[];
			range?: { from: Date };
		}
		let filters: Filters = { status: "open", tags: ["a"] };
		expect(written({ filters })).toBe("filters[status]=open&filters[tags][0]=a");
	});

	test("rejects values it has no text for", () => {
		// @ts-expect-error a symbol has no query string form
		stringify({ a: Symbol("a") });
		// @ts-expect-error a file has no query string form
		stringify({ a: new File(["x"], "a.txt") });
	});
});

describe("toFormData", () => {
	test("writes the same keys stringify writes", () => {
		let value = { post: { title: "Hi", tags: ["a", "b"] }, draft: false, at: null };
		let form = toFormData(value);
		expect([...form]).toEqual([...new URLSearchParams(stringify(value))]);
	});

	test("appends files as-is", () => {
		let photo = new File(["x"], "photo.png", { type: "image/png" });
		let form = toFormData({ post: { title: "Hi", photos: [photo] } });
		let appended = form.get("post[photos][0]");
		expect(appended).toBeInstanceOf(File);
		expect((appended as File).name).toBe("photo.png");
		expect(form.get("post[title]")).toBe("Hi");
	});

	test("round-trips files through parse", () => {
		let photo = new File(["x"], "photo.png");
		let result = parse(toFormData({ photos: [photo, photo] }), s.any());
		if (result.status === "failure") throw result.error;
		expect(result.data).toEqual({ photos: [expect.any(File), expect.any(File)] });
	});
});

describe("round trip", () => {
	test("parse reproduces any value whose leaves are strings", () => {
		let value = {
			q: "hello world",
			filter: { status: "open", tags: ["a", "b"] },
			sort: [
				{ field: "date", dir: "desc" },
				{ field: "name", dir: "asc" },
			],
			long: Array.from({ length: 100 }, (_, index) => String(index)),
		};
		expect(parse(stringify(value), s.any())).toEqual({ status: "success", data: value });
	});
});
