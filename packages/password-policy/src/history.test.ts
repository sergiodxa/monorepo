/**
 * Covers the reuse rule against real scrypt hashes: a match at any position, the
 * `maxHistory` cap, a stored hash that cannot be verified, and that the comparison
 * uses the password exactly as submitted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { password } from "@sdxc/crypto";
import { isSuccess, unwrap } from "@sdxc/result";
import { beforeAll, describe, expect, test } from "vitest";

import type { PasswordPolicyError } from "./password-policy-error.js";

import { checkPasswordHistory, DEFAULT_MAX_HISTORY } from "./history.js";

/** Passwords the account held, newest first. */
const PREVIOUS = ["violet staircase one", "violet staircase two", "violet staircase three"];

/** A stored value no verifier recognizes. */
const CORRUPT = "not-a-password-hash";

/** Hashes of {@link PREVIOUS}, in the same order, derived once for the file. */
const HASHES: string[] = [];

/** One password in its compatibility spelling (`ﬁ`) and its NFKC form (`fi`). */
const LIGATURE = { spelled: "ﬁve harbour lights", normalized: "five harbour lights" };

/** Hashes of each {@link LIGATURE} spelling, derived once for the file. */
const LIGATURE_HASHES = { spelled: "", normalized: "" };

beforeAll(async () => {
	for (let previous of PREVIOUS) HASHES.push(unwrap(await password.hash(previous)));
	LIGATURE_HASHES.spelled = unwrap(await password.hash(LIGATURE.spelled));
	LIGATURE_HASHES.normalized = unwrap(await password.hash(LIGATURE.normalized));
});

/** The issue a failed result carries, or `null` for an accepted candidate. */
function issueOf(result: Result<void, PasswordPolicyError>) {
	return isSuccess(result) ? null : result.error.issue;
}

describe("checkPasswordHistory", () => {
	test("caps the history at five entries by default", () => {
		expect(DEFAULT_MAX_HISTORY).toBe(5);
	});

	test("accepts any candidate when the history is empty", async () => {
		expect(issueOf(await checkPasswordHistory(PREVIOUS[0]!, []))).toBeNull();
	});

	test("refuses the newest password, reporting its position", async () => {
		expect(issueOf(await checkPasswordHistory(PREVIOUS[0]!, HASHES))).toEqual({
			reason: "reused",
			index: 0,
		});
	});

	test("refuses a password from the middle of the history", async () => {
		expect(issueOf(await checkPasswordHistory(PREVIOUS[1]!, HASHES))).toEqual({
			reason: "reused",
			index: 1,
		});
	});

	test("refuses the oldest password in the history", async () => {
		expect(issueOf(await checkPasswordHistory(PREVIOUS[2]!, HASHES))).toEqual({
			reason: "reused",
			index: 2,
		});
	});

	test("accepts a password the history does not hold", async () => {
		expect(issueOf(await checkPasswordHistory("violet staircase four", HASHES))).toBeNull();
	});

	test("ignores hashes beyond `maxHistory`", async () => {
		expect(issueOf(await checkPasswordHistory(PREVIOUS[2]!, HASHES, { maxHistory: 2 }))).toBeNull();
		expect(issueOf(await checkPasswordHistory(PREVIOUS[1]!, HASHES, { maxHistory: 2 }))).toEqual({
			reason: "reused",
			index: 1,
		});
	});

	test("reports a stored hash it cannot verify as the check being unavailable", async () => {
		let result = await checkPasswordHistory("violet staircase four", [HASHES[0]!, CORRUPT]);

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "history-check-unavailable", index: 1 });
		expect(result.error.cause).toBeInstanceOf(Error);
	});

	test("refuses a confirmed reuse even after an earlier hash failed to verify", async () => {
		expect(issueOf(await checkPasswordHistory(PREVIOUS[1]!, [CORRUPT, HASHES[1]!]))).toEqual({
			reason: "reused",
			index: 1,
		});
	});

	test("compares the password as submitted, not its NFKC form", async () => {
		expect(
			issueOf(await checkPasswordHistory(LIGATURE.spelled, [LIGATURE_HASHES.normalized])),
		).toBeNull();
		expect(
			issueOf(await checkPasswordHistory(LIGATURE.spelled, [LIGATURE_HASHES.spelled])),
		).toEqual({ reason: "reused", index: 0 });
	});
});
