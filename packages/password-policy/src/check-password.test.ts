/**
 * Covers the combined policy: which rules run by default, the order they run in, and
 * that the breached-password lookup leaves the process only when a caller enables it
 * and only after every local rule has accepted the candidate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { PasswordPolicyError } from "./password-policy-error.js";

import { PWNED_PASSWORDS_RANGE_URL } from "./breached.js";
import { checkPassword } from "./check-password.js";

/** A candidate every local rule accepts under the defaults. */
const STRONG = "violet staircase under the harbour";

/** How many range lookups the current test made, reset after each one. */
const LOOKUPS: string[] = [];

/** The Pwned Passwords stand-in; an unhandled request fails the test. */
const SERVER = setupServer();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	SERVER.resetHandlers();
	LOOKUPS.length = 0;
});
afterAll(() => SERVER.close());

/** Answers every range lookup with the given lines, recording each request. */
function answerWith(lines: string[]) {
	SERVER.use(
		http.get(`${PWNED_PASSWORDS_RANGE_URL}:prefix`, ({ request }) => {
			LOOKUPS.push(request.url);
			return HttpResponse.text(lines.join("\r\n"));
		}),
	);
}

/** The issue a failed result carries, or `null` for an accepted candidate. */
function issueOf(result: Result<void, PasswordPolicyError>) {
	return isSuccess(result) ? null : result.error.issue;
}

describe("checkPassword", () => {
	test("accepts a long uncommon passphrase under the defaults", async () => {
		expect(issueOf(await checkPassword(STRONG))).toBeNull();
	});

	test("applies NIST's 15-character minimum by default", async () => {
		expect(issueOf(await checkPassword("short but fine"))).toEqual({
			reason: "too-short",
			minLength: 15,
			length: 14,
		});
	});

	test("applies the 256 code point maximum by default", async () => {
		expect(issueOf(await checkPassword("a".repeat(257)))).toEqual({
			reason: "too-long",
			maxLength: 256,
			length: 257,
		});
	});

	test("checks the common list by default and can turn it off", async () => {
		expect(issueOf(await checkPassword("Password1", { minLength: 8 }))).toEqual({
			reason: "common",
		});
		expect(issueOf(await checkPassword("Password1", { minLength: 8, common: false }))).toBeNull();
	});

	test("refuses a candidate built from the account's identifiers", async () => {
		expect(
			issueOf(await checkPassword("jane.doe was here in 2026", { identifiers: ["jane.doe@x.io"] })),
		).toEqual({ reason: "similar-to-identifier", fragment: "jane.doe" });
	});

	test("refuses a candidate containing a denied term", async () => {
		expect(
			issueOf(await checkPassword("acme is the best place", { deniedTerms: ["ACME"] })),
		).toEqual({ reason: "denied-term", term: "ACME" });
	});

	test("reports length before anything else", async () => {
		expect(issueOf(await checkPassword("password", { deniedTerms: ["pass"] }))?.reason).toBe(
			"too-short",
		);
	});

	test("reports a common password before an identifier or denied term match", async () => {
		let issue = issueOf(
			await checkPassword("password1", {
				minLength: 8,
				identifiers: ["password1"],
				deniedTerms: ["pass"],
			}),
		);

		expect(issue?.reason).toBe("common");
	});

	test("reports an identifier match before a denied term match", async () => {
		let issue = issueOf(
			await checkPassword("janedoe at the acme office", {
				identifiers: ["janedoe"],
				deniedTerms: ["acme"],
			}),
		);

		expect(issue?.reason).toBe("similar-to-identifier");
	});

	test("never contacts the breach API unless enabled", async () => {
		expect(issueOf(await checkPassword(STRONG))).toBeNull();
		expect(LOOKUPS).toHaveLength(0);
	});

	test("looks the candidate up once the lookup is enabled", async () => {
		answerWith([]);
		expect(issueOf(await checkPassword(STRONG, { breached: true }))).toBeNull();
		expect(LOOKUPS).toHaveLength(1);
	});

	test("reports the lookup's own result when enabled with options", async () => {
		SERVER.use(
			http.get(`${PWNED_PASSWORDS_RANGE_URL}:prefix`, ({ request }) => {
				LOOKUPS.push(request.headers.get("User-Agent") ?? "");
				return new HttpResponse(null, { status: 500 });
			}),
		);

		let issue = issueOf(await checkPassword(STRONG, { breached: { userAgent: "example/1" } }));

		expect(issue).toEqual({ reason: "breach-check-unavailable", failure: "status", status: 500 });
		expect(LOOKUPS).toEqual(["example/1"]);
	});

	test("skips the lookup when a local rule already refused the candidate", async () => {
		answerWith([]);

		expect(issueOf(await checkPassword("too short", { breached: true }))?.reason).toBe("too-short");
		expect(LOOKUPS).toHaveLength(0);
	});
});
