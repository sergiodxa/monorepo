/**
 * Email verification: issuing the single-use token the message carries, holding back a
 * further send while an issued token is still usable, and consuming a token to record
 * that a subject's address is confirmed.
 *
 * It exists as one module because the send is driven from three places — a credential
 * sign-in, a provider sign-in and an explicit resend — and the one condition that decides
 * whether mail goes out at all must be the same sentence in all three. The token and the
 * cooldown live in KV, both short-lived and self-expiring, with no need for a place in the
 * database's fixed shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import type { SelectSubject } from "~/database/schema";

import { ISSUER_HOST } from "~/app/config";
import Subject from "~/app/data/subject";
import { DEFAULT_EMAIL_LOCALE } from "~/app/emails/locale";
import { VerifyEmailEmail } from "~/app/emails/verify-email";
import routes from "~/routes/web";

/**
 * How long a verification token stays usable, and — deliberately the same number — how
 * long a further send to the same address is held back for: a resend held back never
 * outlives its token, so suppression cannot strand anyone with no way to verify.
 */
export const VERIFICATION_TTL_MS = 5 * 60 * 1000;

/** {@link VERIFICATION_TTL_MS} as KV counts expiry, and as the copy quotes it. */
const VERIFICATION_TTL_SECONDS = VERIFICATION_TTL_MS / 1000;

/** {@link VERIFICATION_TTL_MS} in whole minutes, which is the unit the message is written in. */
const VERIFICATION_TTL_MINUTES = VERIFICATION_TTL_MS / 60_000;

/**
 * KV prefix an issued token's record is stored under, keyed by the token's own digest so
 * the store never contains a value that could be replayed as a link: reading the
 * namespace yields only hashes, and a hash cannot be mailed to anybody.
 */
const TOKEN_KEY_PREFIX = "email-verification:";

/**
 * KV prefix the per-address send window is marked under, keyed by the address digest so no
 * key in the namespace spells out an address, and written only once its token record
 * exists, so a failed store can never hold the window open against an unusable link.
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
 * Why consuming a token did not confirm an address: `invalid` covers every reason it is no
 * good — expired, used, malformed, or issued for another address — as one outcome, so a
 * link holder cannot learn which; `unavailable` is the store itself failing, worth retrying.
 */
export type VerificationFailureReason = "invalid" | "unavailable";

/**
 * A refused verification, carrying only the coarse reason a page may act on.
 *
 * An `Error` because that is what a `Result` failure is; the message is a fixed diagnostic
 * and never quotes the token, the address or the subject.
 */
export class VerificationError extends Error {
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
 * @throws When the platform's digest is unavailable, signaling a broken runtime a caller
 *   cannot act on.
 */
async function digest(value: string): Promise<string> {
	let hashed = await sha256(value);
	if (isFailure(hashed)) throw hashed.error;

	return Hex.encode(hashed.data);
}

/**
 * The address as the send window is keyed on it, lower-cased so re-casing an address
 * cannot buy a second send around the per-address limit.
 */
function cooldownSubject(emailAddress: string): string {
	return emailAddress.trim().toLowerCase();
}

/**
 * Absolute URL a message's button points at, carrying the token. Built against the
 * published issuer host so the link resolves the same way wherever it is opened, and
 * from the typed route so the path cannot drift from the route table.
 */
function verificationUrl(token: string): string {
	let url = new URL(routes.verifyEmail.index.href(), ISSUER_HOST);
	url.searchParams.set("token", token);

	return url.toString();
}

/**
 * Sends the verification message when one is needed and none was sent recently, gated on
 * `subjects.email_verified_at` being null and called only for a successful sign-in: mailing
 * whichever address a form supplies on any other outcome would make this an oracle.
 *
 * @param ctx - The request the send is attached to; its mailer, translator and logger.
 * @param db - Database the subject's address and verification state are read from.
 * @param subjectId - Subject whose address would be confirmed.
 * @returns Which of the four things happened, so a resend page can say so. A sign-in's
 *   own response is identical on every outcome, so sign-in paths can ignore it.
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
 * Resolves a presented token to the subject it was issued for, checking that its record
 * still names both that subject and its current address — a token proves nothing once the
 * row's address has moved on — and, only when asked, spends it to confirm the address.
 *
 * @param db - Database the subject is read from and the column written to.
 * @param token - The token exactly as the link carried it.
 * @param spend - Whether to delete the record and stamp the column. The record is deleted
 *   before anything is written, the same way an authorization code is consumed by being
 *   read, so two submissions of one link cannot both reach the write.
 * @returns The subject the token names, or why the token is good for nothing — one shared
 *   refusal for both callers, so what a token is good for cannot drift between them.
 */
async function resolveToken(
	db: Database,
	token: string,
	spend: boolean,
): Promise<Result<SelectSubject, VerificationError>> {
	let key: string;

	try {
		key = TOKEN_KEY_PREFIX + (await digest(token));
	} catch {
		return failure(new VerificationError("unavailable"));
	}

	let stored = await env.KV.get(key);
	if (stored === null) return failure(new VerificationError("invalid"));

	if (spend) await env.KV.delete(key);

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

	if (subject.email_address !== parsed.data.emailAddress)
		return failure(new VerificationError("invalid"));

	if (!spend) return success(subject);

	if (subject.email_verified_at !== null) return success(subject);

	return success(await Subject.update(db, subject.id, { email_verified_at: Date.now() }));
}

/**
 * Reports whether a presented token would confirm an address, without spending it, so a
 * mail scanner, link checker, or bodyless probe that fetches the URL out of an inbox
 * leaves the token exactly as it found it and the person's own click still works.
 *
 * @param db - Database the subject is read from.
 * @param token - The token exactly as the link carried it.
 * @returns The subject the token names, or why it is good for nothing.
 */
export async function peekVerificationToken(
	db: Database,
	token: string,
): Promise<Result<SelectSubject, VerificationError>> {
	return await resolveToken(db, token, false);
}

/**
 * Consumes a verification token and records that the address it was issued for is
 * confirmed. A subject already verified answers as a success without rewriting the
 * column, so a link submitted twice in one session reads as already done.
 *
 * @param db - Database the subject is read from and the column written to.
 * @param token - The token exactly as the link carried it.
 * @returns The confirmed subject, or why nothing was confirmed.
 */
export async function consumeVerificationToken(
	db: Database,
	token: string,
): Promise<Result<SelectSubject, VerificationError>> {
	return await resolveToken(db, token, true);
}
