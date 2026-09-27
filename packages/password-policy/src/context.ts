/**
 * The context-specific rules NIST SP 800-63B lists beside breach corpora: a password
 * built from the account's own identifiers, or containing a term the service denies
 * (its own name, say). Both compare folded forms, so case and compatibility spellings match.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { countCodePoints, foldPassword } from "./normalize.js";
import { PasswordPolicyError } from "./password-policy-error.js";

/**
 * Shortest identifier fragment compared. A shorter one matches almost any password, which
 * would refuse it for a reason the person typing could not connect to their account.
 */
const MIN_FRAGMENT_LENGTH = 3;

/**
 * The folded parts of each identifier a password is compared against: an email's local
 * part and first domain label, or any other identifier whole.
 */
function identifierFragments(identifiers: string[]): string[] {
	let fragments: string[] = [];

	for (let identifier of identifiers) {
		let folded = foldPassword(identifier.trim());
		let at = folded.lastIndexOf("@");

		if (at === -1) {
			fragments.push(folded);
			continue;
		}

		fragments.push(folded.slice(0, at));
		let label = folded.slice(at + 1).split(".")[0];
		if (label) fragments.push(label);
	}

	return fragments.filter((fragment) => countCodePoints(fragment) >= MIN_FRAGMENT_LENGTH);
}

/**
 * Refuses a candidate that contains one of the account's identifiers, or that is itself
 * contained in one, such as an email's local part or a username.
 *
 * @param identifiers - Raw identifiers as the account holds them; emails are split at `@`.
 * @returns The fragment that matched, as `similar-to-identifier`, or success.
 */
export function checkIdentifiers(
	candidate: string,
	identifiers: string[],
): Result<void, PasswordPolicyError> {
	let folded = foldPassword(candidate);
	let long = countCodePoints(folded) >= MIN_FRAGMENT_LENGTH;

	for (let fragment of identifierFragments(identifiers)) {
		if (folded.includes(fragment) || (long && fragment.includes(folded))) {
			return failure(new PasswordPolicyError({ reason: "similar-to-identifier", fragment }));
		}
	}

	return success(undefined);
}

/**
 * Refuses a candidate containing any of the denied terms. A term is trimmed and folded
 * before comparison and a blank one is skipped; the failure names it as configured.
 */
export function checkDeniedTerms(
	candidate: string,
	terms: string[],
): Result<void, PasswordPolicyError> {
	let folded = foldPassword(candidate);

	for (let term of terms) {
		let foldedTerm = foldPassword(term.trim());
		if (foldedTerm.length > 0 && folded.includes(foldedTerm)) {
			return failure(new PasswordPolicyError({ reason: "denied-term", term }));
		}
	}

	return success(undefined);
}
