/**
 * Folding rules for the two identifier kinds a subject may hold: what turns two
 * spellings a person reads as the same address or handle into the one comparison form
 * the uniqueness index is built on. Kept standalone from the object's storage because
 * the rules are pure and worth testing without a database in front of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
 * Folds an email address: NFKC-normalized, the local part case-folded, and the domain
 * lowercased and IDNA-encoded. Stops at that general rule — a dotted Gmail local part or
 * a plus-addressed one folds to itself, because the platform does not know which mail
 * host applies which rule and a wrong guess would merge two real mailboxes into one
 * account.
 */
function foldEmail(value: string): FoldResult {
	let normalized = value.normalize("NFKC");
	let at = normalized.indexOf("@");

	if (at <= 0 || at !== normalized.lastIndexOf("@") || at === normalized.length - 1) {
		return { ok: false, reason: "invalid-email" };
	}

	let local = normalized.slice(0, at);
	let domain = normalized.slice(at + 1);

	if (/[\s/\\]/.test(local) || /[\s/\\@]/.test(domain)) {
		return { ok: false, reason: "invalid-email" };
	}

	let encodedDomain = encodeDomain(domain);
	if (encodedDomain === null) return { ok: false, reason: "invalid-email" };

	return { ok: true, folded: `${local.toLowerCase()}@${encodedDomain}` };
}

/**
 * Lowercases and IDNA-encodes a domain the way it will be looked up and delivered to.
 *
 * `mailto:` carries no host of its own to parse — it is not one of the schemes the URL
 * standard treats specially — so a domain is IDNA-encoded by routing it through a
 * scheme that does, discarding everything the parser adds beyond the host it resolved.
 *
 * @param domain - The domain as it appeared after the `@`.
 * @returns The lowercased, IDNA-encoded domain, or `null` when it does not parse as one.
 */
function encodeDomain(domain: string): string | null {
	let url: URL;

	try {
		url = new URL(`http://${domain}`);
	} catch {
		return null;
	}

	if (url.port !== "" || url.username !== "" || url.password !== "") return null;
	if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;

	return url.hostname;
}
