/**
 * Checks that every password policy refusal renders an English message on its field, so a
 * refusal reason added to the policy never reaches a form as a raw translation key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { PasswordPolicyFailure } from "~/database/passwords";

import { mailTranslator } from "~/app/mail/locale";

import { passwordPolicyIssue } from "./password-policy-issue";

let FAILURES: [PasswordPolicyFailure, string][] = [
	[{ ok: false, reason: "too-short", minLength: 8, length: 5 }, "at least 8 characters"],
	[{ ok: false, reason: "too-long", maxLength: 256, length: 300 }, "at most 256 characters"],
	[{ ok: false, reason: "common" }, "easy to guess"],
	[{ ok: false, reason: "breached", occurrences: 3 }, "data breach"],
	[{ ok: false, reason: "similar-to-identifier", fragment: "jane" }, "similar to your email"],
	[{ ok: false, reason: "denied-term", term: "acme" }, 'contain "acme"'],
	[{ ok: false, reason: "reused", index: 0 }, "haven't used before"],
	[
		{ ok: false, reason: "breach-check-unavailable", failure: "timeout", status: null },
		"couldn't check",
	],
	[{ ok: false, reason: "history-check-unavailable", index: 1 }, "couldn't check"],
];

describe("passwordPolicyIssue", () => {
	test.each(FAILURES)("renders %o on the password field", (failure, expected) => {
		let { t } = mailTranslator();

		let issue = passwordPolicyIssue(t, failure, "password");

		expect(issue.path).toEqual(["password"]);
		expect(issue.message).toContain(expected);
	});
});
