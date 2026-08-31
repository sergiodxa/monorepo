/**
 * Unit tests for the standalone HTTP cookies: the `returnTo`/`language`/
 * `dashboardTab` cookies are smoke-tested for a serialize/parse round trip
 * through `remix/cookie`'s real (unsigned) codec.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { dashboardTab, language, returnTo } from "~/app/http/cookies";

/** Extracts the `name=value` pair from a `Set-Cookie` header, usable as a `Cookie` header. */
function toCookieHeader(setCookie: string): string {
	return setCookie.split(";")[0]!;
}

describe("returnTo/language/dashboardTab cookies", () => {
	test("returnTo round-trips a value through serialize/parse", async () => {
		let setCookie = await returnTo.serialize("/app/acme");
		let parsed = await returnTo.parse(toCookieHeader(setCookie));
		expect(parsed).toBe("/app/acme");
	});

	test("language round-trips a value through serialize/parse", async () => {
		let setCookie = await language.serialize("es");
		let parsed = await language.parse(toCookieHeader(setCookie));
		expect(parsed).toBe("es");
	});

	test("dashboardTab round-trips a value through serialize/parse", async () => {
		let setCookie = await dashboardTab.serialize("dns");
		let parsed = await dashboardTab.parse(toCookieHeader(setCookie));
		expect(parsed).toBe("dns");
	});

	test("parse returns null when the Cookie header is absent", async () => {
		expect(await returnTo.parse(null)).toBeNull();
	});
});
