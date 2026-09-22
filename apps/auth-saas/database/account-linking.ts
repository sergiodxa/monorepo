/**
 * The account-linking decision: whether a provider's response proves enough to
 * attach a resolved sign-in to a subject a matching address already belongs to, or
 * whether it has to be confirmed first. {@link evaluateAutomaticLink} is pure — it
 * takes what a caller already resolved (the response, the connection's authority
 * and setting, and the one subject a folded address matched) and answers which
 * path applies, carrying which condition fell short when it did not clear every
 * one. It assumes its caller already found exactly one subject the address
 * belongs to, since finding none is the existing `on_unknown_subject` path and
 * finding more than one cannot happen once a folded address is already unique to
 * a single subject in the tenant.
 *
 * {@link isConnectionAuthoritativeForEmail} resolves the other input a caller
 * needs first: whether the connection may be believed about this one address,
 * either because the catalog (or the connection's own override) marks it a
 * per-response authority, or because it owns a verified domain the address falls
 * inside.
 *
 * {@link mintLinkTicket} and {@link spendLinkTicket} carry a sign-in through the
 * confirmed path: a single-use, hashed ticket naming the subject and provider
 * identity a later credential proves, following the same delete-then-check-expiry
 * idiom `connection_handoffs` and `password_reset_tickets` already use, so a
 * replayed spend always finds nothing left to take.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Hex, open, seal, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

import { organizationDomains } from "./organizations";
import { encodeDomain } from "./subject-identifiers";

/**
 * How long a confirmed-path ticket names its subject and provider identity before
 * it expires — the same half hour a password reset ticket gives someone to act on
 * a message they were sent, long enough to sign in with a credential they already
 * hold without leaving the ticket answerable indefinitely.
 */
const LINK_TICKET_TTL_MS = 30 * 60 * 1000;

/** How large a ticket's stored claims may serialize to before they are truncated. */
const MAX_CLAIMS_JSON_BYTES = 4 * 1024;

/** Mints a `linktkt` id for a new `pending_link_tickets` row. */
const pendingLinkTicketRowId = typeid("linktkt");

/**
 * The subject and provider identity a confirmed-path sign-in is waiting to attach,
 * named by a single-use ticket rather than by anything a caller presents itself.
 * Carries what completing the link needs to write once a credential proves the
 * subject: the claims a resolved sign-in already mapped, and the provider's
 * refresh token, sealed the same way a completed sign-in seals one.
 */
export const pendingLinkTickets = table({
	name: "pending_link_tickets",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		ticket_hash: c.text(),
		connection_id: c.text(),
		provider_subject: c.text(),
		subject_id: c.text(),
		provider_email: c.text().nullable(),
		provider_email_verified: c.boolean().nullable(),
		granted_scopes: c.json().nullable(),
		claims_json: c.text().nullable(),
		refresh_token_sealed: c.text().nullable(),
		token_expires_at: c.integer().nullable(),
		expires_at: c.integer(),
		created_at: c.integer(),
	},
});

export type PendingLinkTicketRow = TableRow<typeof pendingLinkTickets>;

/**
 * Serializes a response's claims for storage, truncated to a bounded size — kept
 * for a tenant to inspect when a mapping looks wrong, not reparsed by this
 * platform, so a truncated tail staying valid JSON is not something this needs.
 *
 * @param claims - The claim set to bound, or `null` for none.
 * @returns The bounded JSON text, or `null` when `claims` was `null`.
 */
export function boundClaimsJson(claims: Record<string, unknown> | null): string | null {
	if (claims === null) return null;

	let json = JSON.stringify(claims);
	let bytes = new TextEncoder().encode(json);
	if (bytes.length <= MAX_CLAIMS_JSON_BYTES) return json;

	return new TextDecoder().decode(bytes.slice(0, MAX_CLAIMS_JSON_BYTES));
}

/** The domain half of an address, folded the same way a verified organization domain is, or `null` for one with no domain to read. */
function domainOf(email: string): string | null {
	let at = email.indexOf("@");
	if (at <= 0 || at === email.length - 1) return null;
	return encodeDomain(email.slice(at + 1));
}

/**
 * Whether a connection may be believed about one address without asking the
 * subject to prove it again: either the connection is marked a per-response
 * authority — the catalog's own judgement, or a tenant's override for a
 * from-scratch connection — or it owns an organization whose claim on the
 * address's domain has been verified. A domain claim is read fresh rather than
 * cached, since it is only ever the authority for addresses inside it.
 *
 * @param db - The tenant's database.
 * @param connection - The connection an address's authority is being asked about.
 * @param email - The address the provider's response carried.
 * @returns Whether the connection is authoritative for this one address.
 */
export async function isConnectionAuthoritativeForEmail(
	db: Database,
	connection: { email_authority: boolean; organization_id: string | null },
	email: string,
): Promise<boolean> {
	if (connection.email_authority) return true;
	if (connection.organization_id === null) return false;

	let domain = domainOf(email);
	if (domain === null) return false;

	let domainRow = await db.find(organizationDomains, { domain });
	if (!domainRow || domainRow.verified_at === null) return false;

	return domainRow.organization_id === connection.organization_id;
}

/** The one subject a folded address already matched, and what {@link evaluateAutomaticLink} needs to know about it. */
export interface MatchedSubjectForLinking {
	/** Whether the matched `email` identifier itself carries `verified_at`. */
	identifierVerified: boolean;
	/** The matched subject's own status. */
	subjectStatus: "active" | "blocked";
}

export interface EvaluateAutomaticLinkInput {
	/** The email address the provider's response carried, or `null` for one that carried none. */
	responseEmail: string | null;
	/** Whether the response itself asserted that address verified, in that same response. */
	responseEmailVerified: boolean;
	/** Whether the connection is an authoritative source for this address, from {@link isConnectionAuthoritativeForEmail}. */
	connectionIsAuthoritative: boolean;
	/** The connection's own `auto_link` setting. */
	connectionAutoLink: boolean;
	/** The one subject the folded address matched, or `null` when the caller found none. */
	matchedSubject: MatchedSubjectForLinking | null;
}

/** Which of the automatic linking rule's conditions the confirmed path is running in place of. */
export type AutomaticLinkBlockedReason =
	| "no-response-email"
	| "response-email-not-verified"
	| "connection-not-authoritative"
	| "no-matched-identifier"
	| "identifier-not-verified"
	| "subject-not-active"
	| "auto-link-disabled";

export type AutomaticLinkDecision =
	| { outcome: "automatic" }
	| { outcome: "confirmed"; reason: AutomaticLinkBlockedReason };

/**
 * The automatic linking rule: an identity attaches to the subject a folded address
 * already matched with nothing further proved only when every condition below
 * holds. Falling short of any one of them takes the confirmed path instead — the
 * subject stands untouched and a ticket is minted for a credential to complete the
 * link with — rather than refusing the sign-in outright.
 *
 * Assumes its caller already resolved the one subject a folded address matches;
 * finding none is the existing `on_unknown_subject` path, not this rule, and
 * finding more than one cannot happen once a folded address is already unique to
 * a single subject in the tenant, so this function's own `matchedSubject: null`
 * case only guards against being called before that resolution ran.
 *
 * @param input - The response's email and its own verified claim, the connection's
 * authority and `auto_link` setting, and the one subject the address matched.
 * @returns `automatic` once every condition holds, or `confirmed` naming which one
 * did not.
 */
export function evaluateAutomaticLink(input: EvaluateAutomaticLinkInput): AutomaticLinkDecision {
	if (input.responseEmail === null) return { outcome: "confirmed", reason: "no-response-email" };
	if (!input.responseEmailVerified) {
		return { outcome: "confirmed", reason: "response-email-not-verified" };
	}
	if (!input.connectionIsAuthoritative) {
		return { outcome: "confirmed", reason: "connection-not-authoritative" };
	}
	if (input.matchedSubject === null) {
		return { outcome: "confirmed", reason: "no-matched-identifier" };
	}
	if (!input.matchedSubject.identifierVerified) {
		return { outcome: "confirmed", reason: "identifier-not-verified" };
	}
	if (input.matchedSubject.subjectStatus !== "active") {
		return { outcome: "confirmed", reason: "subject-not-active" };
	}
	if (!input.connectionAutoLink) return { outcome: "confirmed", reason: "auto-link-disabled" };

	return { outcome: "automatic" };
}

export interface MintLinkTicketInput {
	connectionId: string;
	providerSubject: string;
	subjectId: string;
	providerEmail: string | null;
	providerEmailVerified: boolean | null;
	grantedScopes: string[] | null;
	claims: Record<string, unknown> | null;
	refreshToken: string | null;
	tokenExpiresAt: number | null;
}

/**
 * Mints a single-use ticket for the confirmed path: the subject a folded address
 * matched, the provider identity asking to attach to it, and what completing that
 * later needs, storing only the ticket's hash.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The connection, provider identity and matched subject the ticket
 * names, and the claims and refresh token a later spend needs to complete the link.
 * @returns The plaintext ticket to hand back to the sign-in page.
 */
export async function mintLinkTicket(
	db: Database,
	sealKey: CryptoKey,
	input: MintLinkTicketInput,
): Promise<string> {
	let refreshTokenSealed: string | null = null;

	if (input.refreshToken !== null) {
		let sealed = await seal(sealKey, input.refreshToken);
		if (isFailure(sealed)) throw new Error("failed to seal the connection's refresh token");
		refreshTokenSealed = sealed.data;
	}

	let ticket = generateUUID();

	let hashed = await sha256(ticket);
	if (isFailure(hashed)) throw new Error("failed to hash the account-link ticket");

	let now = Date.now();

	await db.create(pendingLinkTickets, {
		id: pendingLinkTicketRowId(generateUUID()).toString(),
		ticket_hash: Hex.encode(hashed.data),
		connection_id: input.connectionId,
		provider_subject: input.providerSubject,
		subject_id: input.subjectId,
		provider_email: input.providerEmail,
		provider_email_verified: input.providerEmailVerified,
		granted_scopes: input.grantedScopes,
		claims_json: boundClaimsJson(input.claims),
		refresh_token_sealed: refreshTokenSealed,
		token_expires_at: input.tokenExpiresAt,
		expires_at: now + LINK_TICKET_TTL_MS,
		created_at: now,
	});

	return ticket;
}

export type SpendLinkTicketResult =
	| {
			ok: true;
			connectionId: string;
			providerSubject: string;
			subjectId: string;
			providerEmail: string | null;
			providerEmailVerified: boolean | null;
			grantedScopes: string[] | null;
			claimsJson: string | null;
			refreshToken: string | null;
			tokenExpiresAt: number | null;
	  }
	| { ok: false; reason: "invalid-ticket" };

/**
 * Spends a confirmed-path ticket: everything it named, with its refresh token
 * opened back to the plaintext a later `upsertConnectionIdentity` call takes.
 *
 * The ticket is deleted the moment its row is found, before its expiry is even
 * checked, so a replayed spend always finds nothing left to take — the same rule
 * a password reset ticket and a connection handoff ticket answer a second
 * attempt with.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The ticket as it was presented.
 * @returns Everything the ticket named, or that it does not work.
 */
export async function spendLinkTicket(
	db: Database,
	sealKey: CryptoKey,
	input: { ticket: string },
): Promise<SpendLinkTicketResult> {
	let hashed = await sha256(input.ticket);
	if (isFailure(hashed)) return { ok: false, reason: "invalid-ticket" };

	let row = await db.findOne(pendingLinkTickets, {
		where: { ticket_hash: Hex.encode(hashed.data) },
	});
	if (!row) return { ok: false, reason: "invalid-ticket" };

	await db.delete(pendingLinkTickets, { id: row.id });

	if (row.expires_at <= Date.now()) return { ok: false, reason: "invalid-ticket" };

	let refreshToken: string | null = null;

	if (row.refresh_token_sealed !== null) {
		let opened = await open(sealKey, row.refresh_token_sealed);
		if (isFailure(opened))
			throw new Error("failed to open the account-link ticket's refresh token");
		refreshToken = opened.data;
	}

	return {
		ok: true,
		connectionId: row.connection_id,
		providerSubject: row.provider_subject,
		subjectId: row.subject_id,
		providerEmail: row.provider_email,
		providerEmailVerified: row.provider_email_verified,
		grantedScopes: row.granted_scopes as string[] | null,
		claimsJson: row.claims_json,
		refreshToken,
		tokenExpiresAt: row.token_expires_at,
	};
}
