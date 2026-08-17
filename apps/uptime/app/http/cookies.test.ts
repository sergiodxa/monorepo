/**
 * Unit tests for the standalone HTTP cookies. `safeReturnTo` is pure decision
 * logic over a string, tested directly with no router/database involved; the
 * `returnTo`/`language`/`dashboardTab` cookies are smoke-tested for a
 * serialize/parse round trip through `remix/cookie`'s real (unsigned) codec.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { dashboardTab, language, returnTo, safeReturnTo } from "~/app/http/cookies";

/** Extracts the `name=value` pair from a `Set-Cookie` header, usable as a `Cookie` header. */
function toCookieHeader(setCookie: string): string {
	return setCookie.split(";")[0]!;
}

describe("safeReturnTo", () => {
	test("falls back to the given fallback when the value is null", () => {
		expect(safeReturnTo(null, "/app")).toBe("/app");
	});

	test("falls back to the given fallback when the value is undefined", () => {
		expect(safeReturnTo(undefined, "/app")).toBe("/app");
	});

	test("falls back when the value doesn't start with a slash", () => {
		expect(safeReturnTo("https://evil.com/phish", "/app")).toBe("/app");
	});

	test("falls back for a protocol-relative //host value (open-redirect guard)", () => {
		expect(safeReturnTo("//evil.com", "/app")).toBe("/app");
	});

	test("passes through a normal same-origin relative path unchanged", () => {
		expect(safeReturnTo("/app/team", "/app")).toBe("/app/team");
	});
});

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
