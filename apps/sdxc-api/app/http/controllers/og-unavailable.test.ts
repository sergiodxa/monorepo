/**
 * A face that fails to parse answers `GET /og.png` with a 500 that the colo
 * cache does not store, so the next isolate can try the bundled fonts again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FontError } from "@sdxc/font";
import { failure } from "@sdxc/result";
import { afterEach, describe, expect, test, vi } from "vitest";

import { OG_IMAGE_PATH } from "~/config/site";

vi.doMock("~/app/initializers/og-fonts", () => ({
	ogFonts: () => failure(new FontError("malformed", "unreadable")),
}));

const { createWebRouter } = await import("~/app/initializers/router");

/** How many times the stand-in was written. A 500 must leave this at zero. */
let puts = 0;

afterEach(() => {
	puts = 0;
	Reflect.deleteProperty(globalThis, "caches");
});

describe("GET /og.png when a font fails to parse", () => {
	test("answers 500 and does not store the failure", async () => {
		let cache = {
			async match(): Promise<Response | undefined> {
				return undefined;
			},
			async put(): Promise<void> {
				puts += 1;
			},
		};
		(globalThis as unknown as { caches?: { default: typeof cache } }).caches = { default: cache };

		let response = await createWebRouter().fetch(
			new Request(`https://api.sdxc.dev${OG_IMAGE_PATH}`),
		);
		expect(response.status).toBe(500);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toBe("The Open Graph image could not be drawn.");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(puts).toBe(0);
	});
});
