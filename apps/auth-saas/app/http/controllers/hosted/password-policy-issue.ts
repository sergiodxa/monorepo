/**
 * Maps a `PasswordPolicyFailure` — the refusal shape `setPassword` and
 * `completePasswordReset` both answer with — to the `Form.Issue` its field
 * renders, so hosted sign-up and reset and platform sign-up share one
 * translation of every password policy refusal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Form } from "@sdxc/ui";

import type { PasswordPolicyFailure } from "~/database/passwords";

/**
 * Builds the form issue a password policy refusal renders on the given field.
 *
 * @param t - The request's translation function.
 * @param failure - The refusal `setPassword`/`completePasswordReset` answered with.
 * @param field - The form field the candidate password was submitted under.
 * @returns The issue to add to the re-rendered form's `issues`.
 */
export function passwordPolicyIssue(
	t: Translate,
	failure: PasswordPolicyFailure,
	field: string,
): Form.Issue {
	let message: string;

	switch (failure.reason) {
		case "too-short":
			message = t("hostedPassword.errors.tooShort", { minLength: failure.minLength });
			break;
		case "too-long":
			message = t("hostedPassword.errors.tooLong", { maxLength: failure.maxLength });
			break;
		case "common":
			message = t("hostedPassword.errors.common");
			break;
		case "breached":
			message = t("hostedPassword.errors.breached");
			break;
		case "similar-to-identifier":
			message = t("hostedPassword.errors.similarToIdentifier");
			break;
		case "denied-term":
			message = t("hostedPassword.errors.deniedTerm", { term: failure.term });
			break;
		case "reused":
			message = t("hostedPassword.errors.reused");
			break;
		case "breach-check-unavailable":
		case "history-check-unavailable":
			message = t("hostedPassword.errors.checkUnavailable");
			break;
	}

	return { message, path: [field] };
}
