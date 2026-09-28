/**
 * The author-email rule: an address on a disposable-mail domain. It lives under its own export
 * path because the domain list it reads is large, so a consumer who never checks email never
 * bundles it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { parseEmailAddress } from "@sdxc/email-address";
import { findDisposableDomain } from "@sdxc/email-address/disposable";
import { isSuccess } from "@sdxc/result";

import type { Signal, SpamCheck } from "./check.js";

/**
 * Scores an author email on a disposable domain. An address that fails to parse draws nothing,
 * since validating the field is the form's job.
 *
 * @example createSpamFilter({ checks: [...DEFAULT_RULES, authorEmail()] })
 */
export function authorEmail(options: authorEmail.Options = {}): SpamCheck {
	let disposableScore = options.disposableScore ?? 3;

	return {
		name: "author-email",
		stage: "local",
		check(submission): Signal[] {
			let email = submission.author?.email;
			if (!email) return [];
			let parsed = parseEmailAddress(email);
			if (!isSuccess(parsed)) return [];
			let listed = findDisposableDomain(parsed.data.domain);
			if (listed === null) return [];
			return [
				{
					check: "author-email.disposable",
					score: disposableScore,
					detail: `${listed} is a disposable email domain`,
				},
			];
		},
	};
}

/** The options {@link authorEmail} takes. */
export namespace authorEmail {
	/** Weights for the author-email rule. */
	export interface Options {
		/** @default 3 */
		disposableScore?: number;
	}
}
