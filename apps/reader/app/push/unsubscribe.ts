/**
 * The one-click way out of the email channel: a link signed for one reader, which a mailbox
 * provider's button and a person's click both reach without a session, and the check that
 * turns such a link back into the reader it was signed for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { MailError } from "@sdxc/mail";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "@sdxc/mail/unsubscribe";
import { failure, isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import routes from "~/routes/web";

/** The list a link leaves, which is the whole email channel: it carries nothing else. */
const NOTIFICATIONS_LIST = "notifications";

/**
 * The domain prefix every signature covers, which keeps these links apart from the session
 * cookies the same key signs: neither can ever be read as the other.
 */
const PURPOSE = "reader-notifications-unsubscribe:v1:";

/**
 * The key every link is signed under, the session cookie's: a link then needs nothing new
 * provisioned, and rotating the key retires delivered links alongside every session.
 */
function secret(): string {
	return env.COOKIE_SESSION_SECRET;
}

/**
 * The address a notification email's unsubscribe button and link point at, signed for one
 * reader. A deployment with no key set gets a failure, and sends its email without one.
 *
 * @param subject - The reader's OIDC subject, which the token carries instead of an address.
 * @param appUrl - Where this app answers, which the link is absolute against.
 */
export async function unsubscribeUrl(
	subject: string,
	appUrl: string,
): Promise<Result<string, MailError>> {
	if (!secret()) return failure(new MailError("COOKIE_SESSION_SECRET is not set"));

	let token = await signUnsubscribeToken(
		secret(),
		{ subject, list: NOTIFICATIONS_LIST },
		{ purpose: PURPOSE },
	);
	if (isFailure(token)) return token;

	return success(new URL(routes.unsubscribe.index.href({ token: token.data }), appUrl).toString());
}

/**
 * The reader a link was signed for, or `null` for anything this app did not sign, including
 * every link while no key is set, so the endpoint fails closed.
 *
 * @param token - The path segment the link arrived with.
 */
export async function unsubscribingReader(token: string): Promise<string | null> {
	if (!secret()) return null;

	let claims = await verifyUnsubscribeToken(secret(), token, { purpose: PURPOSE });
	if (isFailure(claims) || claims.data.list !== NOTIFICATIONS_LIST) return null;

	return claims.data.subject;
}
