/**
 * View model for the verification signal on the profile page: the badge beside the
 * address, and — while the address is unconfirmed — the panel offering a resend and the
 * sentence reporting what the last resend did.
 *
 * The outcome arrives as a query parameter, so this is also where an unrecognized value is
 * dropped: the parameter is in a URL anybody can retype, and a page must not render a
 * message because somebody put one in their own address bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@pkg/i18n";

import type { VerificationSendOutcome } from "~/app/services/email-verification";

import { VERIFICATION_TTL_MS } from "~/app/services/email-verification";

/** Query parameter the resend redirect names its outcome in. */
export const RESEND_OUTCOME_PARAM = "resend";

/**
 * The outcomes the profile page has a sentence for.
 *
 * `not_needed` is absent on purpose: it means the address was already confirmed, and the
 * page reached with it renders the confirmed state, which says so on its own.
 */
const REPORTED_OUTCOMES: readonly VerificationSendOutcome[] = ["sent", "suppressed", "failed"];

/** Locale key holding the sentence for each reported outcome. */
const OUTCOME_KEYS: Readonly<Record<string, string>> = {
	sent: "profile.view.emailVerification.sent",
	suppressed: "profile.view.emailVerification.cooldown",
	failed: "profile.view.emailVerification.failed",
};

export namespace EmailVerificationViewModel {
	/** What the profile page renders about the address's verification state. */
	export interface Output {
		/** Whether `subjects.email_verified_at` holds an instant. */
		verified: boolean;
		/** Badge text beside the address, in either state. */
		badge: string;
		/** Heading of the resend panel; only read while unverified. */
		title: string;
		/** What being unverified costs the reader. */
		description: string;
		/** Label of the resend button. */
		action: string;
		/** Where the resend button posts. */
		actionHref: string;
		/** What the last resend did, or `null` when this is not a redirect from one. */
		notice: string | null;
	}
}

export default class EmailVerificationViewModel {
	/**
	 * Builds the profile page's verification props.
	 *
	 * @param t - The request's translator.
	 * @param emailVerifiedAt - `subjects.email_verified_at`, as epoch milliseconds or null.
	 * @param outcome - The `resend` query parameter exactly as it arrived, if at all.
	 * @param actionHref - Where the resend form posts.
	 */
	static default(
		t: i18n,
		emailVerifiedAt: number | null,
		outcome: string | null,
		actionHref: string,
	): EmailVerificationViewModel.Output {
		let verified = emailVerifiedAt !== null;
		let reported = REPORTED_OUTCOMES.includes(outcome as VerificationSendOutcome);

		return {
			verified,
			badge: verified
				? t.t("profile.view.emailVerification.verified")
				: t.t("profile.view.emailVerification.unverified"),
			title: t.t("profile.view.emailVerification.title"),
			description: t.t("profile.view.emailVerification.description"),
			action: t.t("profile.view.emailVerification.action"),
			actionHref,
			// The lifetime the sentence quotes comes from the same constant the token and the
			// resend window are cut from, so the page cannot promise a window they do not share.
			notice: reported
				? t.t(OUTCOME_KEYS[outcome as string]!, { minutes: VERIFICATION_TTL_MS / 60_000 })
				: null,
		};
	}
}
