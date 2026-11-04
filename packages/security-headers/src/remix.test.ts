/**
 * Tests that `remixCsp` quotes keywords and substitutes the nonce the way Remix's `csp()`
 * factory return type expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { remixCsp } from "./remix.js";

describe("remixCsp", () => {
	test("quotes keywords and substitutes the nonce", () => {
		expect(remixCsp({ defaultSrc: ["self"], scriptSrc: ["self", "nonce"] }, "abc+/=")).toEqual({
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'nonce-abc+/='"],
		});
	});

	test("keeps host sources and report-to as Remix expects", () => {
		expect(
			remixCsp(
				{
					frameSrc: ["https://challenges.example.com"],
					objectSrc: ["none"],
					reportTo: "csp",
					upgradeInsecureRequests: true,
				},
				"n",
			),
		).toEqual({
			frameSrc: ["https://challenges.example.com"],
			objectSrc: ["'none'"],
			reportTo: "csp",
			upgradeInsecureRequests: true,
		});
	});

	test("returns an empty object when every source is dropped", () => {
		expect(remixCsp({}, "n")).toEqual({});
	});
});
