/**
 * Tests of the rules a new password must pass: the eight-character floor and 256-character
 * ceiling this server keeps, the common list, the account's own address and username, and
 * the breach lookup, which refuses a breached password and lets one through when it is down.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { checkNewPassword } from "~/app/auth/password-policy";
import { pwnedPasswords, pwnedPasswordsUnavailable } from "~/app/lib/test/pwned-passwords";

/** A password every rule accepts. */
const GOOD_PASSWORD = "a-brand-new-password";

/** A password that passes every local rule and that the stand-in API reports as breached. */
const BREACHED_PASSWORD = "breached-but-long";

/** The account the identifier rule compares against. */
const IDENTIFIERS = ["jane.doe@example.com", "janedoe"];

let server = setupServer(pwnedPasswords([BREACHED_PASSWORD]));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The rule a refused password broke, or `null` when it was accepted. */
async function refusal(candidate: string): Promise<string | null> {
	let result = await checkNewPassword(candidate, IDENTIFIERS);
	return result.status === "failure" ? result.error.issue.reason : null;
}

describe("checkNewPassword()", () => {
	test("accepts a password every rule passes", async () => {
		expect(await refusal(GOOD_PASSWORD)).toBeNull();
	});

	test("keeps eight characters as the floor, so an existing-length password is still accepted", async () => {
		expect(await refusal("tuvw-xyz")).toBeNull();
		expect(await refusal("tuv-xyz")).toBe("too-short");
	});

	test("refuses a password over 256 characters before anything hashes it", async () => {
		expect(await refusal("x".repeat(256))).toBeNull();
		expect(await refusal("x".repeat(257))).toBe("too-long");
	});

	test("refuses a password on the common list", async () => {
		expect(await refusal("password123")).toBe("common");
	});

	test("refuses a password containing the account's email local part or username", async () => {
		expect(await refusal("jane.doe-rocks")).toBe("similar-to-identifier");
		expect(await refusal("xx-janedoe-xx")).toBe("similar-to-identifier");
	});

	test("refuses a password the breach lookup reports", async () => {
		expect(await refusal(BREACHED_PASSWORD)).toBe("breached");
	});

	test("accepts a password the local rules passed when the breach lookup is down", async () => {
		server.use(pwnedPasswordsUnavailable());

		expect(await refusal(BREACHED_PASSWORD)).toBeNull();
	});
});
