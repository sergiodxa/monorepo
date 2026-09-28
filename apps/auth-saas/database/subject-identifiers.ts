/**
 * Folding rules for the two identifier kinds a subject may hold: what turns two
 * spellings a person reads as the same address or handle into the one comparison form
 * the uniqueness index is built on. Kept standalone from the object's storage because
 * the rules are pure and worth testing without a database in front of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseEmailAddress } from "@sdxc/email-address";
import { isFailure } from "@sdxc/result";

/** The two identifier kinds a subject may hold. */
export type IdentifierKind = "email" | "username";

/** A folded value, ready to compare or store, or the reason the input was refused. */
export type FoldResult =
	| { ok: true; folded: string }
	| { ok: false; reason: "invalid-email" }
	| { ok: false; reason: "invalid-username" };

/** A username may hold letters, digits, and the three separators `.`, `-` and `_`. */
const USERNAME_PATTERN = /^[\p{L}\p{N}._-]+$/u;

/**
 * Folds an identifier into the form its uniqueness is compared on.
 *
 * @param kind - Which folding rule applies: an email address or a username.
 * @param value - The value as the person typed it.
 * @returns The folded form, or which validation rule the value failed.
 * @example
 * foldIdentifier("email", "Jane.Doe@Example.COM");
 * // { ok: true, folded: "jane.doe@example.com" }
 */
export function foldIdentifier(kind: IdentifierKind, value: string): FoldResult {
	if (kind === "username") return foldUsername(value);
	return foldEmail(value);
}

/**
 * Folds a username: NFKC-normalized, case-folded, and restricted to letters, digits,
 * `.`, `-` and `_`. A username proves nothing on its own, so its comparison form is a
 * straight fold with no domain to reason about.
 */
function foldUsername(value: string): FoldResult {
	let folded = value.normalize("NFKC").toLowerCase();

	if (folded.length === 0 || !USERNAME_PATTERN.test(folded)) {
		return { ok: false, reason: "invalid-username" };
	}

	return { ok: true, folded };
}

/**
 * Folds an email address to its canonical form: NFKC-normalized, the local part case-folded,
 * and the domain lowercased and IDNA-encoded. Dotted and plus-addressed local parts fold to
 * themselves, since only the mail host knows which spellings share a mailbox.
 */
function foldEmail(value: string): FoldResult {
	let parsed = parseEmailAddress(value);
	if (isFailure(parsed)) return { ok: false, reason: "invalid-email" };

	return { ok: true, folded: parsed.data.canonical };
}
