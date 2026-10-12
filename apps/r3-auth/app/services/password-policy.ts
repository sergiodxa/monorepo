/**
 * The rules a password must pass before this server stores it, at registration and on
 * a reset (length, the common-password list, similarity to the account, the Have I Been
 * Pwned lookup), and the sentence each refusal shows. Sign-in runs none of them, so a
 * password stored under older rules keeps working.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PasswordPolicyError } from "@sdxc/password-policy";
import type { Result } from "@sdxc/result";
import type { RequestContext } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { checkPassword } from "@sdxc/password-policy";
import { isSuccess, success } from "@sdxc/result";

/**
 * Fewest characters a new password may have. Eight is NIST's floor for a password that
 * is not the only authenticator; raising it to 15 is a product decision still to be made.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Most characters a new password may have, so one submission cannot turn a scrypt
 * derivation into an arbitrarily long one. Far above any real passphrase.
 */
export const PASSWORD_MAX_LENGTH = 256;

/**
 * How long the breach lookup may take before the password is let through, in
 * milliseconds; short enough that a slow answer never stalls the form noticeably.
 */
const BREACH_CHECK_TIMEOUT = 2000;

/** Identifies this server to the Pwned Passwords API, which asks every client for one. */
const BREACH_CHECK_USER_AGENT = "auth.sergiodxa.com";

/**
 * Checks a password someone is about to set.
 *
 * A breach lookup that gets no answer accepts the password, since every local rule has
 * already passed by then: an outage at Have I Been Pwned never blocks a sign-up or reset.
 *
 * @param candidate - The password exactly as submitted.
 * @param identifiers - The account's email address and username, which it may not contain.
 * @returns Success, or the refusal whose `issue` names the rule it broke.
 */
export async function checkNewPassword(
	candidate: string,
	identifiers: string[],
): Promise<Result<void, PasswordPolicyError>> {
	let result = await checkPassword(candidate, {
		minLength: PASSWORD_MIN_LENGTH,
		maxLength: PASSWORD_MAX_LENGTH,
		identifiers,
		breached: { userAgent: BREACH_CHECK_USER_AGENT, timeout: BREACH_CHECK_TIMEOUT },
	});

	if (isSuccess(result)) return result;

	let issue = result.error.issue;
	if (issue.reason !== "breach-check-unavailable") return result;

	currentLog()?.warn("password_policy.breach_check_unavailable", {
		failure: issue.failure,
		status: issue.status,
	});

	return success(undefined);
}

/**
 * The sentence a form shows for a refused password, in the request's language. Only the
 * rules {@link checkNewPassword} runs can reach a person; any other issue reads as a plain
 * request for a different password.
 *
 * @param issue - The refusal's `issue`, as {@link checkNewPassword} answered it.
 */
export function passwordRefusalMessage(
	ctx: RequestContext,
	issue: PasswordPolicyError.Issue,
): string {
	switch (issue.reason) {
		case "too-short":
			return ctx.intl.t("password.policy.tooShort", { minLength: issue.minLength });
		case "too-long":
			return ctx.intl.t("password.policy.tooLong", { maxLength: issue.maxLength });
		case "common":
			return ctx.intl.t("password.policy.common");
		case "breached":
			return ctx.intl.t("password.policy.breached");
		case "similar-to-identifier":
			return ctx.intl.t("password.policy.similarToIdentifier");
		default:
			return ctx.intl.t("password.policy.other");
	}
}
