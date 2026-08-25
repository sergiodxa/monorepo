/**
 * Covers client-locale resolution from the Accept-Language header: quality
 * ordering, wildcard and invalid-tag filtering, the missing-header case, and
 * accepting either a Request or a Headers object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { getClientLocales } from "./get-client-locales";

function makeRequest(acceptLanguage?: string): Request {
	return new Request("https://example.com/", {
		headers: acceptLanguage ? { "Accept-Language": acceptLanguage } : undefined,
	});
}

describe(getClientLocales, () => {
	test("returns undefined without an Accept-Language header", () => {
		expect(getClientLocales(makeRequest())).toBeUndefined();
	});

	test("returns the highest-quality locale", () => {
		expect(getClientLocales(makeRequest("en;q=0.8,es;q=0.9"))).toBe("es");
	});

	test("keeps region subtags", () => {
		expect(getClientLocales(makeRequest("en-US,en;q=0.9"))).toBe("en-US");
	});

	test("ignores wildcard ranges", () => {
		expect(getClientLocales(makeRequest("*,fr;q=0.9"))).toBe("fr");
	});

	test("accepts a Headers object", () => {
		let headers = new Headers({ "Accept-Language": "pt-BR" });
		expect(getClientLocales(headers)).toBe("pt-BR");
	});
});
