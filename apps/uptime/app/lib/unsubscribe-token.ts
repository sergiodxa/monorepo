/**
 * Signs and verifies the token a team digest's one-click unsubscribe link carries, under a
 * key of its own read from Secrets Store, while links mailed under the session secret before
 * that key existed keep verifying until they age out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UnsubscribeToken } from "@sdxc/mail/unsubscribe";
import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { MailError } from "@sdxc/mail";
import {
	InvalidUnsubscribeTokenError,
	signUnsubscribeToken,
	verifyUnsubscribeToken,
} from "@sdxc/mail/unsubscribe";
import { failure, isSuccess } from "@sdxc/result";
import { env } from "cloudflare:workers";

/**
 * The domain prefix every digest token's MAC covers, under either key. It is the prefix every
 * delivered digest link was signed with, which is what lets those links keep verifying.
 */
const DIGEST_PURPOSE: UnsubscribeToken.Options = { purpose: "digest-unsubscribe:v1:" };

/**
 * The dedicated unsubscribe key, or `null` when the Secrets Store binding cannot be read, so
 * each caller decides how an unreadable key closes.
 */
async function readUnsubscribeSecret(): Promise<string | null> {
	try {
		return (await env.UNSUBSCRIBE_SECRET.get()) || null;
	} catch {
		return null;
	}
}

/**
 * Signs a digest unsubscribe token for one member and one digest. An unreadable key is a
 * failure, which the digest job answers by skipping that send.
 *
 * @param claims - The member's subject id and the optional email the link turns off.
 * @returns The token, or a `MailError` when the key or the claims are unusable.
 */
export async function signDigestUnsubscribeToken(claims: {
	subject: string;
	list: string;
}): Promise<Result<string, MailError>> {
	let secret = await readUnsubscribeSecret();
	if (!secret) return failure(new MailError("The UNSUBSCRIBE_SECRET binding could not be read."));
	return await signUnsubscribeToken(secret, claims, DIGEST_PURPOSE);
}

/**
 * Verifies a digest unsubscribe token under the dedicated key first, then under
 * `COOKIE_SESSION_SECRET`, which signed every link mailed before the dedicated key existed.
 * Each fallback hit is counted as `unsubscribe.legacy_secret` on the request's log; the
 * fallback is removable once that counter stays at zero for 90 consecutive days.
 *
 * @param token - The path segment from the unsubscribe URL.
 * @returns The claims, or an `InvalidUnsubscribeTokenError` when neither key signed it.
 */
export async function verifyDigestUnsubscribeToken(
	token: string,
): Promise<Result<UnsubscribeToken.Claims, InvalidUnsubscribeTokenError>> {
	let secret = await readUnsubscribeSecret();
	if (secret) {
		let claims = await verifyUnsubscribeToken(secret, token, DIGEST_PURPOSE);
		if (isSuccess(claims)) return claims;
	}

	if (!env.COOKIE_SESSION_SECRET) return failure(new InvalidUnsubscribeTokenError());
	let legacy = await verifyUnsubscribeToken(env.COOKIE_SESSION_SECRET, token, DIGEST_PURPOSE);
	if (isSuccess(legacy)) currentLog()?.inc("unsubscribe.legacy_secret");
	return legacy;
}
