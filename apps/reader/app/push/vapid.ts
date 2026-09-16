/**
 * The application server's Web Push identity, read off the environment. A push service
 * authenticates a sender by this one key pair, so it is deployment state rather than
 * per-reader state, and the app is simply silent on the channel while it is unset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import type { VapidKeys } from "~/app/push/web-push";

/**
 * The key pair and contact address every delivery is signed with, or `null` when the
 * deployment carries none — which is what lets the channel stay dark on an environment
 * that has not had `wrangler secret put` run against it yet.
 *
 * @example let keys = vapidKeys(); if (keys === null) return;
 */
export function vapidKeys(): VapidKeys | null {
	let publicKey = env.VAPID_PUBLIC_KEY;
	let privateKey = env.VAPID_PRIVATE_KEY;
	let subject = env.VAPID_SUBJECT;

	if (!publicKey || !privateKey || !subject) return null;

	return { publicKey, privateKey, subject };
}

/**
 * The public half alone, which is what a browser needs as its `applicationServerKey` to
 * subscribe at all and is therefore rendered into the page.
 */
export function vapidPublicKey(): string | null {
	return env.VAPID_PUBLIC_KEY || null;
}
