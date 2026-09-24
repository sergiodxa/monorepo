/**
 * Exercises the Passkey Endpoints document, where every member is optional, and the
 * change-password redirect beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { redirect } from "./change-password.js";
import { parse, passkeyEndpoints, stringify } from "./passkey-endpoints.js";

describe(parse, () => {
	test("reads the enroll, manage and PRF details URLs", () => {
		let endpoints = unwrap(
			parse(
				JSON.stringify({
					enroll: "https://example.com/passkeys/new",
					manage: "https://example.com/passkeys",
					prf_usage_details: "https://example.com/prf",
					future: 1,
				}),
			),
		);
		expect(endpoints).toEqual({
			enroll: new URL("https://example.com/passkeys/new"),
			manage: new URL("https://example.com/passkeys"),
			prfUsageDetails: new URL("https://example.com/prf"),
		});
	});

	test("reads an empty object as a valid document", () => {
		expect(unwrap(parse("{}"))).toEqual({ enroll: null, manage: null, prfUsageDetails: null });
	});

	test("fails on a member that is not a URL", () => {
		expect(isFailure(parse(JSON.stringify({ enroll: "/passkeys/new" })))).toBe(true);
	});
});

describe(stringify, () => {
	test("writes only the members set", () => {
		let text = stringify({
			enroll: null,
			manage: new URL("https://example.com/passkeys"),
			prfUsageDetails: null,
		});
		expect(JSON.parse(text)).toEqual({ manage: "https://example.com/passkeys" });
		expect(unwrap(passkeyEndpoints.parse(text)).manage?.href).toBe("https://example.com/passkeys");
	});
});

describe(redirect, () => {
	test("answers with a 302 to the change-password page", () => {
		let response = redirect("/password/forgot");
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/password/forgot");
		expect(redirect(new URL("https://example.com/account")).headers.get("Location")).toBe(
			"https://example.com/account",
		);
	});
});
