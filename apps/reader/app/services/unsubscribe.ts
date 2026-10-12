/**
 * The one-click way out of the email channel: a link signed for one reader under a key of its
 * own from Secrets Store, which a mailbox provider's button and a person's click both reach
 * without a session, and the check that turns such a link back into that reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UnsubscribeToken } from "@sdxc/mail/unsubscribe";
import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { MailError } from "@sdxc/mail";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "@sdxc/mail/unsubscribe";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import routes from "~/routes/web";

/** The list a link leaves, which is the whole email channel: it carries nothing else. */
const NOTIFICATIONS_LIST = "notifications";

/**
 * The domain prefix every signature covers, under either key. It is the prefix every
 * delivered link was signed with, which is what lets those links keep verifying.
 */
const PURPOSE = "reader-notifications-unsubscribe:v1:";

/**
 * The dedicated unsubscribe key, or `null` when the Secrets Store binding cannot be read, so
 * signing fails and verification falls through to the session secret.
 */
async function readUnsubscribeSecret(): Promise<string | null> {
	try {
		return (await env.UNSUBSCRIBE_SECRET.get()) || null;
	} catch {
		return null;
	}
}

/**
 * The address a notification email's unsubscribe button and link point at, signed for one
 * reader under the dedicated key. An unreadable key is a failure, and the email goes out
 * without a link.
 *
 * @param subject - The reader's OIDC subject, which the token carries instead of an address.
 * @param appUrl - Where this app answers, which the link is absolute against.
 */
export async function unsubscribeUrl(
	subject: string,
	appUrl: string,
): Promise<Result<string, MailError>> {
	let secret = await readUnsubscribeSecret();
	if (!secret) return failure(new MailError("The UNSUBSCRIBE_SECRET binding could not be read."));

	let token = await signUnsubscribeToken(
		secret,
		{ subject, list: NOTIFICATIONS_LIST },
		{ purpose: PURPOSE },
	);
	if (isFailure(token)) return token;

	return success(new URL(routes.unsubscribe.index.href({ token: token.data }), appUrl).toString());
}

/**
 * The reader a link was signed for, checked under the dedicated key and then under
 * `COOKIE_SESSION_SECRET`, which signed every link mailed before it; each fallback hit counts
 * as `unsubscribe.legacy_secret`, and the fallback goes once that stays zero for 90 days.
 *
 * @param token - The path segment the link arrived with.
 * @returns The reader's subject, or `null` for anything neither key signed.
 */
export async function unsubscribingReader(token: string): Promise<string | null> {
	let secret = await readUnsubscribeSecret();
	if (secret) {
		let claims = await verifyUnsubscribeToken(secret, token, { purpose: PURPOSE });
		if (isSuccess(claims)) return readerOf(claims.data);
	}

	if (!env.COOKIE_SESSION_SECRET) return null;
	let legacy = await verifyUnsubscribeToken(env.COOKIE_SESSION_SECRET, token, { purpose: PURPOSE });
	if (isFailure(legacy)) return null;
	currentLog()?.inc("unsubscribe.legacy_secret");
	return readerOf(legacy.data);
}

/** The subject of claims for the notifications list, or `null` for a token naming another list. */
function readerOf(claims: UnsubscribeToken.Claims): string | null {
	return claims.list === NOTIFICATIONS_LIST ? claims.subject : null;
}
