/**
 * Tests for `vary()`.
 *
 * Merging is the whole contract: a response that already varies on one header and
 * then adds another must keep both, because dropping a name lets a shared cache
 * serve a variant that was negotiated for someone else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { vary } from "./vary.js";

describe(vary, () => {
	test("merges into an existing value instead of replacing it", () => {
		let headers = new Headers({ Vary: "Accept-Encoding" });

		vary(headers, ["Accept-Language", "Cookie"]);

		expect(headers.get("Vary")).toBe("accept-encoding, accept-language, cookie");
	});

	test("sets the header when the response does not vary yet", () => {
		let headers = new Headers();

		vary(headers, ["Accept-Language"]);

		expect(headers.get("Vary")).toBe("accept-language");
	});

	test("accepts a single header name", () => {
		let headers = new Headers({ Vary: "Accept-Encoding" });

		vary(headers, "Accept-Language");

		expect(headers.get("Vary")).toBe("accept-encoding, accept-language");
	});

	test("does not repeat a name already present, whatever its case", () => {
		let headers = new Headers({ Vary: "accept-language" });

		vary(headers, ["Accept-Language"]);

		expect(headers.get("Vary")).toBe("accept-language");
	});

	test("leaves the headers untouched when there is nothing to add", () => {
		let headers = new Headers();

		vary(headers, []);

		expect(headers.has("Vary")).toBe(false);
	});

	test("returns the same Headers object, so calls can be chained", () => {
		let headers = new Headers();

		expect(vary(headers, ["Cookie"])).toBe(headers);
	});
});
