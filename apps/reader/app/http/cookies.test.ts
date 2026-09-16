/**
 * The presentation cookie, which is the one input to how a page is painted that arrives
 * before anything is rendered. What matters here is that nothing outside the two closed
 * sets ever reaches a template: the cookie is unsigned, so a tampered value is an ordinary
 * case rather than an attack, and the defaults are what answers it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { PRESENTATION_COOKIE, readPresentation, writePresentation } from "~/app/http/cookies";

/** What a reader who has never chosen anything is shown. */
const DEFAULTS = { theme: "system", face: "sans" } as const;

describe("readPresentation", () => {
	test("answers the defaults for a browser carrying no cookie", () => {
		expect(readPresentation(undefined)).toEqual(DEFAULTS);
	});

	test("answers the stored choice for a cookie holding one", () => {
		expect(readPresentation(JSON.stringify({ theme: "dark", face: "serif" }))).toEqual({
			theme: "dark",
			face: "serif",
		});
	});

	test("answers the defaults for text that is not the shape at all", () => {
		expect(readPresentation("not json")).toEqual(DEFAULTS);
		expect(readPresentation("[]")).toEqual(DEFAULTS);
		expect(readPresentation(42)).toEqual(DEFAULTS);
	});

	test("answers the defaults for a scheme or a face outside its set", () => {
		expect(readPresentation(JSON.stringify({ theme: "sepia", face: "serif" }))).toEqual(DEFAULTS);
		expect(readPresentation(JSON.stringify({ theme: "dark", face: "comic" }))).toEqual(DEFAULTS);
	});

	test("fills in whichever half an older cookie left out", () => {
		expect(readPresentation(JSON.stringify({ theme: "light" }))).toEqual({
			theme: "light",
			face: "sans",
		});
	});
});

describe("writePresentation", () => {
	test("writes a value the same reader reads back unchanged", async () => {
		let header = await writePresentation({ theme: "dark", face: "serif" });
		let value = await PRESENTATION_COOKIE.parse(header.split(";")[0] ?? "");

		expect(readPresentation(value)).toEqual({ theme: "dark", face: "serif" });
	});

	test("keeps the cookie off other sites and out of script", async () => {
		let header = await writePresentation(DEFAULTS);

		expect(header).toContain("HttpOnly");
		expect(header).toContain("SameSite=Lax");
		expect(header).toContain("Path=/");
	});
});
