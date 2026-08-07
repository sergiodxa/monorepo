/**
 * Email verification: issuing the single-use token the message carries, holding back a
 * further send while an issued token is still usable, and consuming a token to record
 * that a subject's address is confirmed.
 *
 * It exists as one module because the send is driven from three places — a credential
 * sign-in, a provider sign-in and an explicit resend — and the one condition that decides
 * whether mail goes out at all must be the same sentence in all three. The token and the
 * cooldown live in KV rather than in a table: both are short-lived, both expire without
 * anybody sweeping them, and the database's shape is fixed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/fetch-router";

import { Hex, randomToken, sha256 } from "@pkg/crypto";
import { failure, isFailure, success } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import type { SelectSubject } from "~/database/schema";

import { ISSUER_HOST } from "~/app/config";
import Subject from "~/app/data/subject";
import { DEFAULT_EMAIL_LOCALE } from "~/app/emails/locale";
import { VerifyEmailEmail } from "~/app/emails/verify-email";
import routes from "~/routes/web";

/**
 * How long a verification token stays usable — and, deliberately the same number, how
 * long a further send to the same address is held back for.
 *
 * The equality is the invariant, not a coincidence. Because the window a send is held
 * back for never outlasts the token that was issued when it opened, anybody whose resend
 * is suppressed is still holding a link that works, and anybody who waits past the window
 * gets a fresh message with a fresh token. Suppression therefore cannot strand a person
 * with no usable way to verify.
 *
 * Both uses read this one constant so they cannot drift apart. Raising only the token's
 * life would let two live tokens exist per address; raising only the window would refuse a
 * resend for a link that had already died, which is exactly the dead end the equality
 * rules out. **If either is ever changed, both must change together**, which here means
 * changing this.
 */
export const VERIFICATION_TTL_MS = 5 * 60 * 1000;

/** {@link VERIFICATION_TTL_MS} as KV counts expiry, and as the copy quotes it. */
const VERIFICATION_TTL_SECONDS = VERIFICATION_TTL_MS / 1000;

/** {@link VERIFICATION_TTL_MS} in whole minutes, which is the unit the message is written in. */
const VERIFICATION_TTL_MINUTES = VERIFICATION_TTL_MS / 60_000;

/**
 * KV prefix an issued token's record is stored under.
 *
 * The key holds the token's digest rather than the token, so the store never contains a
 * value that could be replayed as a link: reading the namespace yields hashes, and a hash
 * cannot be mailed to anybody.
 */
const TOKEN_KEY_PREFIX = "email-verification:";

/**
 * KV prefix the per-address send window is marked under, keyed by the address digest so no
 * key in the namespace spells out somebody's email address.
 */
const COOLDOWN_KEY_PREFIX = "email-verification-cooldown:";

/** Bytes of entropy in a verification token: 256 bits, so guessing one is not a strategy. */
const TOKEN_BYTES = 32;

/**
 * What a stored token record names. Both fields are the binding: the token is only good
 * for this subject, and only while that subject still holds this exact address.
 */
const TOKEN_RECORD_SCHEMA = s.object({ subjectId: s.string(), emailAddress: s.string() });

/**
 * Why consuming a token did not confirm an address.
 *
 * Only two, and deliberately: `invalid` covers expired, already used, malformed, and
 * issued-for-another-address alike, because those are one outcome to the reader and telling
 * them apart tells whoever holds the link something they should not learn from it.
 * `unavailable` is the store itself failing, which is the one case worth retrying.
 */
export type VerificationFailureReason = "invalid" | "unavailable";

/**
 * A refused verification, carrying only the coarse reason a page may act on.
 *
 * An `Error` because that is what a `Result` failure is; the message is a fixed diagnostic
 * and never quotes the token, the address or the subject.
 */
export class VerificationError extends Error {
	/** Which of the two outcomes this is. */
	readonly reason: VerificationFailureReason;

	/** @param reason - Why nothing was confirmed. */
	constructor(reason: VerificationFailureReason) {
		super(`Email verification ${reason}`);
		this.name = "VerificationError";
		this.reason = reason;
	}
}

/** Outcome of an attempt to send the verification message. */
export type VerificationSendOutcome = "sent" | "not_needed" | "suppressed" | "failed";

/**
 * Hex SHA-256 digest, used for every KV key this module writes.
 *
 * @throws When the platform's digest is unavailable, which is a broken runtime rather
 *   than a condition a caller can act on.
 */
async function digest(value: string): Promise<string> {
	let hashed = await sha256(value);
	if (isFailure(hashed)) throw hashed.error;

	return Hex.encode(hashed.data);
}

/**
 * The address as the send window is keyed on it.
 *
 * Lower-cased so re-casing an address cannot buy a second send, which is the cheapest way
 * around a per-address limit and the reason not to key on the stored spelling.
 */
function cooldownSubject(emailAddress: string): string {
	return emailAddress.trim().toLowerCase();
}

/**
 * Absolute URL a message's button points at, carrying the token.
 *
 * Built against the published issuer host because a relative href in an inbox resolves
 * against nothing, and from the typed route so the path cannot drift from the route table.
 */
function verificationUrl(token: string): string {
	let url = new URL(routes.verifyEmail.href(), ISSUER_HOST);
	url.searchParams.set("token", token);

	return url.toString();
}

/**
 * Sends the verification message to a subject, when one is needed and none was sent
 * recently.
 *
 * **One condition decides whether mail is needed: `subjects.email_verified_at` is null.**
 * It is deliberately not two rules to reconcile. A password registration leaves the column
 * null, and a provider sign-in whose address the provider reported verified does not — so
 * asking about the column already answers "which method did they use", and reading the
 * column is the only thing a caller has to get right. Callers must therefore call this on
 * *every* successful sign-in and let it decide.
 *
 * **Never call it for a refused sign-in.** The condition is about an address, and an
 * endpoint that mails whichever address was typed at it is both an account-existence
 * oracle and a mailer anybody can point at a stranger.
 *
 * The message is deferred rather than awaited, and the whole body is inside a `try`, so a
 * refused delivery or an unreadable subject is logged and swallowed instead of turning a
 * completed sign-in into an error page.
 *
 * The copy is pinned to {@link DEFAULT_EMAIL_LOCALE} rather than following the request:
 * subjects carry no stored language preference, this server ships one language, and the
 * language a message about somebody's own address is written in is not a thing a request
 * should get to choose.
 *
 * @param ctx - The request the send is attached to; its mailer, translator and logger.
 * @param db - Database the subject's address and verification state are read from.
 * @param subjectId - Subject whose address would be confirmed.
 * @returns Which of the four things happened, so a resend page can say so. Sign-in paths
 *   ignore it: nothing about a sign-in changes on any of them.
 */
export async function sendVerificationEmail(
	ctx: RequestContext,
	db: Database,
	subjectId: string,
): Promise<VerificationSendOutcome> {
	try {
		let subject = await Subject.findById(db, subjectId);
		if (!subject) {
			ctx.logger.error("email_verification_subject_missing", { subjectId });
			return "failed";
		}

		// The whole rule. Nothing here asks how they signed in.
		if (subject.email_verified_at !== null) return "not_needed";

		let cooldownKey = COOLDOWN_KEY_PREFIX + (await digest(cooldownSubject(subject.email_address)));

		if ((await env.KV.get(cooldownKey)) !== null) {
			ctx.logger.info("email_verification_suppressed", { subjectId });
			return "suppressed";
		}

		let token = randomToken({ bytes: TOKEN_BYTES });

		await env.KV.put(
			TOKEN_KEY_PREFIX + (await digest(token)),
			JSON.stringify({ subjectId: subject.id, emailAddress: subject.email_address }),
			{ expirationTtl: VERIFICATION_TTL_SECONDS },
		);

		// Marked after the token is stored, never before: a window opened for a token that
		// failed to store would suppress sends for a link nobody can use, which is the one
		// state the shared lifetime exists to make impossible.
		await env.KV.put(cooldownKey, "1", { expirationTtl: VERIFICATION_TTL_SECONDS });

		ctx.email.later(
			new VerifyEmailEmail({
				email: subject.email_address,
				url: verificationUrl(token),
				expiresInMinutes: VERIFICATION_TTL_MINUTES,
				locale: DEFAULT_EMAIL_LOCALE,
				t: ctx.i18next.getFixedT(DEFAULT_EMAIL_LOCALE),
			}),
		);

		// The subject id only. The token is a credential and the address is the person;
		// neither belongs in a log line.
		ctx.logger.info("email_verification_queued", { subjectId });

		return "sent";
	} catch (error) {
		ctx.logger.error("email_verification_failed", {
			subjectId,
			error: error instanceof Error ? error.message : "Unknown error",
		});

		return "failed";
	}
}

/**
 * Consumes a verification token and records that the address it was issued for is
 * confirmed.
 *
 * The token is single-use: its record is deleted before anything is written, the same way
 * an authorization code is consumed by being read. An expired token has no record at all,
 * because KV drops it on its own, so expiry and replay are indistinguishable here — which
 * is what the caller should be telling the reader anyway.
 *
 * The record names both the subject and the address, and both are checked. A token
 * therefore cannot confirm an address it was not mailed to: if the row's address changed
 * after the message went out, the token proves nothing about what it would now be
 * stamping, and it is refused rather than applied to the new address.
 *
 * A subject already verified is answered as a success without rewriting the column, so a
 * link followed twice in one session reads as done rather than as broken.
 *
 * @param db - Database the subject is read from and the column written to.
 * @param token - The token exactly as the link carried it.
 * @returns The confirmed subject, or why nothing was confirmed.
 */
export async function consumeVerificationToken(
	db: Database,
	token: string,
): Promise<Result<SelectSubject, VerificationError>> {
	let key: string;

	try {
		key = TOKEN_KEY_PREFIX + (await digest(token));
	} catch {
		return failure(new VerificationError("unavailable"));
	}

	let stored = await env.KV.get(key);
	if (stored === null) return failure(new VerificationError("invalid"));

	await env.KV.delete(key);

	let record: unknown;
	try {
		record = JSON.parse(stored);
	} catch {
		return failure(new VerificationError("invalid"));
	}

	let parsed = await validate(record as Record<string, unknown>, TOKEN_RECORD_SCHEMA);
	if (isFailure(parsed)) return failure(new VerificationError("invalid"));

	let subject = await Subject.findById(db, parsed.data.subjectId);
	if (!subject) return failure(new VerificationError("invalid"));

	// The binding to the address, not only to the account.
	if (subject.email_address !== parsed.data.emailAddress)
		return failure(new VerificationError("invalid"));

	if (subject.email_verified_at !== null) return success(subject);

	return success(await Subject.update(db, subject.id, { email_verified_at: Date.now() }));
}
