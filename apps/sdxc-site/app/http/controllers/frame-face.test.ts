/**
 * Covers the explorer-face PNG route: a known component answers image/png, an unknown
 * slug is 404. Fonts are read from disk the way social-card tests do, so Vitest never
 * pulls the Worker's `.bin` data modules into the face route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { success } from "@sdxc/result";
import { beforeAll, describe, expect, test, vi } from "vitest";

/** Reads one bundled face from disk, as the Worker receives it as a data module. */
function load(name: string) {
	let result = parseFont(readFileSync(join(import.meta.dirname, "../../../resources/fonts", name)));
	if (result.status === "failure") throw result.error;
	return result.data;
}

let fetchApp: (path: string) => Promise<Response>;

beforeAll(async () => {
	vi.doMock("~/app/initializers/social-card-fonts", () => {
		let fonts = success({
			regular: load("inter-regular.ttf.bin"),
			semibold: load("inter-semibold.ttf.bin"),
			mono: load("jetbrains-mono-regular.ttf.bin"),
		});
		return { socialCardFonts: () => fonts };
	});
	({ fetchApp } = await import("~/app/test/router"));
}, 30_000);

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
