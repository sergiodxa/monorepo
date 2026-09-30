/**
 * Tests for minting back-channel logout tokens. Relying parties compare `iat` and
 * `exp` against the current time in seconds, so a token stamped in milliseconds
 * would look issued thousands of years from now and be rejected.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toUnixSeconds } from "@sdxc/dates";
import { describe, expect, test } from "vitest";

import LogoutToken from "~/app/auth/values/logout-token";

describe("LogoutToken.generate", () => {
	/** RFC 7519 NumericDate claims are seconds, and the specification caps the lifetime at two minutes. */
	test("stamps iat and exp in seconds, two minutes apart", () => {
		let token = LogoutToken.generate("subject-1", "client-1");
		let iat = token.issuedAt?.getTime() ?? Number.NaN;
		let exp = token.expirationTime ?? Number.NaN;

		expect(Math.abs(iat / 1000 - toUnixSeconds(Date.now()))).toBeLessThanOrEqual(1);
		expect(exp - iat / 1000).toBe(120);
	});
});
