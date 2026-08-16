/**
 * The password-recovery token store and the mail it produces: issuing a single-use,
 * short-lived token bound to one subject, holding the per-address cooldown that keeps an
 * unauthenticated endpoint from becoming a mail cannon, and spending a presented token.
 *
 * It is one module because the three questions — may this address be mailed, what token
 * was issued, and which subject does a presented token belong to — have to agree; the
 * controllers only decide what a person sees.
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
 * How long a reset link works for.
 *
 * Longer than the five minutes a code typed back into the same tab gets, because this
 * link is read in an inbox and very often on a different device than the one it is opened
 * on: a phone notification, then a desktop browser, then a password manager. Five minutes
 * loses that person their link and sends them round again. Shorter than an hour, because
 * the token is a bearer credential for one account and every extra minute is time it sits
 * readable in a mailbox, a notification mirror and a browser history.
 */
export const PASSWORD_RESET_TTL = toMs("30 minutes");

/**
 * How long one address must wait before another reset mail can be produced for it.
 *
 * The control that matters on this endpoint: it is unauthenticated and it causes mail to
 * be sent to an address the caller names, so without it anybody can point this server at
 * a mailbox and empty the day's send quota into it — against the sending domain's
 * reputation, not just the recipient's patience. The IP-keyed limiters bound how many
 * requests arrive, not how much mail one address receives, so a distributed caller walks
 * straight through them.
 *
 * It is deliberately well below {@link PASSWORD_RESET_TTL}, which is the invariant that
 * makes suppression safe: a request refused inside the window is a request whose token
 * would still have been valid, so nobody is ever left with no working link. Raising this
 * above the TTL would break that and strand people; the two must be changed together.
 */
export const PASSWORD_RESET_COOLDOWN = toMs("5 minutes");

/** Entropy behind a reset token: 256 bits, so guessing one is not a threat model. */
const TOKEN_BYTES = 32;

/**
 * Pending resets, keyed by the token's digest rather than the token.
 *
 * A reader of this namespace therefore holds hashes, not credentials: the token exists
 * only in the message that was sent and in the link the person clicks. The key space is
 * this app's own and collides with none of the ones shared with the worker still serving
 * production.
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
 * Issues a reset for an address when one belongs to a subject, and queues the mail.
 *
 * Answers nothing. That is the point: the caller returns the same page whatever happened
 * in here, so a caller cannot accidentally branch on whether the address is registered.
 * Every step that could throw is inside one `try`, because a reset request must not become
 * an error page that says "something went wrong for this address and not that one".
 *
 * The cooldown is claimed **before** the subject is looked up, so an address that is not
 * registered is rate-limited exactly like one that is, and the two cost the same lookups.
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
			// No address, and no subject id either: which mailbox is inside a cooldown is
			// exactly the fact this endpoint refuses to report.
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

		// Deferred, so the response the person sees never depends on the provider, and the
		// copy is pinned to this server's own language: the reader of a recovery mail is not
		// necessarily whoever filled in the form, so the requesting browser must not choose
		// the language a message about somebody's account is written in.
		ctx.email.later(
			new ResetPasswordEmail({
				email: subject.email_address,
				url: resetUrl(token),
				minutes: Math.round(PASSWORD_RESET_TTL / toMs("1 minute")),
				locale: DEFAULT_EMAIL_LOCALE,
				t: ctx.i18next.getFixedT(DEFAULT_EMAIL_LOCALE),
			}),
		);

		// The subject id only. The address is the person, and the token is a credential.
		ctx.logger.info("password_reset_requested", { subjectId: subject.id });
	} catch (error) {
		ctx.logger.error("password_reset_request_failed", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}

/**
 * The subject a presented token was issued for, without spending it.
 *
 * Used by the page that renders the form, so an expired or already-spent link becomes a
 * page that says so instead of a form whose submission fails. Reading is safe to repeat:
 * only the submission consumes.
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
 * Spends a presented token and reports the subject it was issued for.
 *
 * The record is deleted before the caller is told anything, so two submissions of the same
 * link cannot both reach the password write: the second one finds nothing. Deleting first
 * is the safe order — a failure after this point costs the person a new link, whereas
 * deleting afterwards would leave a replayable token behind on every such failure.
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

	// The pointer that made this token the newest one goes too, so a later request does not
	// try to retire a record that is already gone.
	await env.KV.delete(`${LATEST_KEY_PREFIX}${subjectId}`);

	return subjectId;
}

/**
 * The subject id inside a stored record, or `null` when the value does not parse.
 *
 * A record that fails validation is treated as no record at all rather than as an error,
 * because the only caller's honest answer to "this link is unusable" is the same page
 * either way.
 */
async function readRecord(stored: string): Promise<string | null> {
	let parsed: unknown;

	try {
		parsed = JSON.parse(stored);
	} catch {
		return null;
	}

	// Narrowed before validating because the validator takes a record: a stored `"null"` or
	// `"[]"` is as unusable as an unparseable one, and reads as no record either way.
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

	let result = await validate(parsed as Record<string, unknown>, PasswordResetRecordSchema);
	if (isFailure(result)) return null;

	return result.data.subject_id;
}
