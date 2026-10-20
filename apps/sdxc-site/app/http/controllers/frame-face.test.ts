/**
 * Covers the explorer-face PNG route: a known component answers image/png, an unknown
 * slug is 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

describe("GET /frames/faces/:component", () => {
	test("serves a PNG for a published component", async () => {
		let response = await fetchApp("/frames/faces/button");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toContain("immutable");
		let bytes = new Uint8Array(await response.arrayBuffer());
		expect(bytes[0]).toBe(0x89);
		expect(bytes[1]).toBe(0x50);
		expect(bytes[2]).toBe(0x4e);
		expect(bytes[3]).toBe(0x47);
	});

	test("answers 404 for a slug the catalogue does not publish", async () => {
		expect((await fetchApp("/frames/faces/not-a-component")).status).toBe(404);
	});
});
