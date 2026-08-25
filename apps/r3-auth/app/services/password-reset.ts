/**
 * The password-recovery token store and the mail it produces: issues a single-use
 * token bound to one subject, enforces a per-address cooldown so an unauthenticated
 * endpoint cannot become a mail cannon, and spends a presented token. Kept as one
 * module because whether an address may be mailed and which subject a token belongs
 * to must stay in agreement; callers only decide what a person sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { Hex, randomToken, sha256 } from "@pkg/crypto";
import { toMs, toSeconds } from "@pkg/duration";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";

import { ISSUER_HOST } from "~/app/config";
import Subject from "~/app/data/subject";
import { DEFAULT_EMAIL_LOCALE } from "~/app/emails/locale";
import { ResetPasswordEmail } from "~/app/emails/reset-password";
import { PasswordResetRecordSchema } from "~/app/http/validators/password";
import routes from "~/routes/web";

/**
 * How long a reset link works for: long enough to survive an inbox opened on a
 * different device than the one that requested it, short enough that a bearer
 * credential does not sit readable in mail and browser history for long.
 */
export const PASSWORD_RESET_TTL = toMs("30 minutes");

/**
 * How long one address must wait before another reset mail can be produced,
 * since IP-keyed limits alone let a distributed caller empty a mailbox's quota.
 * Kept below {@link PASSWORD_RESET_TTL} so a refused request's token is still valid.
 */
export const PASSWORD_RESET_COOLDOWN = toMs("5 minutes");

/** Entropy behind a reset token: 256 bits, so guessing one is not a threat model. */
const TOKEN_BYTES = 32;

/**
 * Pending resets, keyed by the token's digest rather than the token: a reader of
 * this namespace holds hashes, not credentials, since the token itself exists only
 * in the sent message and the clicked link.
 */
const TOKEN_KEY_PREFIX = "password-reset:";

/**
 * Digest of the newest token issued for a subject, so issuing one retires the last.
 *
 * Without it every request inside the TTL would leave another live token in an inbox; with
 * it there is at most one reset outstanding per account at any moment.
 */
const LATEST_KEY_PREFIX = "password-reset-latest:";

/** Per-address cooldown marker, keyed by the address's digest so no mailbox is stored here. */
const COOLDOWN_KEY_PREFIX = "password-reset-cooldown:";

/** The address as it is compared and hashed: case-folded and trimmed. */
function normalizeAddress(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Hex SHA-256 of a value, or `null` when the runtime refused the digest.
 *
 * Every key in this module is derived through here, which is what keeps tokens and
 * addresses out of the store itself.
 */
async function digest(value: string): Promise<string | null> {
	let result = await sha256(value);
	if (isFailure(result)) return null;
	return Hex.encode(result.data);
}

/** Absolute URL a reset link points at, built from the typed route against the issuer. */
function resetUrl(token: string): string {
	let url = new URL(routes.password.reset.index.href(), ISSUER_HOST);
	url.searchParams.set("token", token);
	return url.toString();
}

/**
 * Issues a reset for an address when one belongs to a subject, queuing the mail in
 * the account's own locale since whoever opens the link may not be who submitted
 * the form. Answers identically whether or not the address is registered.
 *
 * @param ctx - The request the form was posted on; its mailer and logger are read from it.
 * @param db - Database the address is resolved against.
 * @param email - The address as submitted; normalized here.
 */
export async function requestPasswordReset(
	ctx: RequestContext,
	db: Database,
	email: string,
): Promise<void> {
	try {
		let address = normalizeAddress(email);

		let cooldownDigest = await digest(address);
		if (!cooldownDigest) {
			ctx.logger.error("password_reset_digest_failed");
			return;
		}

		let cooldownKey = `${COOLDOWN_KEY_PREFIX}${cooldownDigest}`;
		if ((await env.KV.get(cooldownKey)) !== null) {
			ctx.logger.info("password_reset_suppressed");
			return;
		}

		await env.KV.put(cooldownKey, "1", {
			expirationTtl: toSeconds(PASSWORD_RESET_COOLDOWN),
		});

		let subject = await Subject.findByEmail(db, address);
		if (!subject) {
			ctx.logger.info("password_reset_unknown_address");
			return;
		}

		let token = randomToken({ bytes: TOKEN_BYTES });
		let tokenDigest = await digest(token);
		if (!tokenDigest) {
			ctx.logger.error("password_reset_digest_failed", { subjectId: subject.id });
			return;
		}

		let latestKey = `${LATEST_KEY_PREFIX}${subject.id}`;
		let previous = await env.KV.get(latestKey);
		if (previous) await env.KV.delete(`${TOKEN_KEY_PREFIX}${previous}`);

		let ttlSeconds = toSeconds(PASSWORD_RESET_TTL);
		await env.KV.put(
			`${TOKEN_KEY_PREFIX}${tokenDigest}`,
			JSON.stringify({ subject_id: subject.id }),
			{ expirationTtl: ttlSeconds },
		);
		await env.KV.put(latestKey, tokenDigest, { expirationTtl: ttlSeconds });

		ctx.email.later(
			new ResetPasswordEmail({
				email: subject.email_address,
				url: resetUrl(token),
				minutes: Math.round(PASSWORD_RESET_TTL / toMs("1 minute")),
				locale: DEFAULT_EMAIL_LOCALE,
				t: ctx.i18next.getFixedT(DEFAULT_EMAIL_LOCALE),
			}),
		);

		ctx.logger.info("password_reset_requested", { subjectId: subject.id });
	} catch (error) {
		ctx.logger.error("password_reset_request_failed", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}

/**
 * The subject a presented token was issued for, leaving it unspent so the page
 * can flag an expired or already-spent link before the form ever renders; only
 * submission consumes the token.
 *
 * @returns The subject id, or `null` for a token that is unknown, expired, spent or
 *   stored in a shape this server no longer writes.
 */
export async function peekPasswordResetToken(token: string): Promise<string | null> {
	let tokenDigest = await digest(token);
	if (!tokenDigest) return null;

	let stored = await env.KV.get(`${TOKEN_KEY_PREFIX}${tokenDigest}`);
	if (stored === null) return null;

	return await readRecord(stored);
}

/**
 * Spends a presented token and reports the subject it was issued for. Deletes the
 * record before reporting anything, so two submissions of the same link cannot
 * both reach the password write: the second finds nothing already spent.
 *
 * @returns The subject id the token is bound to, or `null` when there is nothing to spend.
 */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
	let tokenDigest = await digest(token);
	if (!tokenDigest) return null;

	let key = `${TOKEN_KEY_PREFIX}${tokenDigest}`;
	let stored = await env.KV.get(key);
	if (stored === null) return null;

	await env.KV.delete(key);

	let subjectId = await readRecord(stored);
	if (!subjectId) return null;

	await env.KV.delete(`${LATEST_KEY_PREFIX}${subjectId}`);

	return subjectId;
}

/**
 * The subject id inside a stored record, or `null` when the value does not parse:
 * a record that fails validation reads as no record, since the only honest answer
 * to "this link is unusable" is the same page either way.
 */
async function readRecord(stored: string): Promise<string | null> {
	let parsed: unknown;

	try {
		parsed = JSON.parse(stored);
	} catch {
		return null;
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

	let result = await validate(parsed as Record<string, unknown>, PasswordResetRecordSchema);
	if (isFailure(result)) return null;

	return result.data.subject_id;
}
