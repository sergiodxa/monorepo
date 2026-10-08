/**
 * Authenticates a GitHub webhook delivery before its controller loads. GitHub signs every
 * body with the hook's secret and sends the HMAC as `X-Hub-Signature-256`; a delivery that
 * does not match answers `401`, so an anonymous `POST` never reaches the work behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { hmac } from "@sdxc/crypto";
import { isSuccess } from "@sdxc/result";

/** How GitHub prefixes the hex HMAC-SHA256 in `X-Hub-Signature-256`. */
const SIGNATURE_PREFIX = "sha256=";

/**
 * Whether `request` carries a signature over its body made with `secret`. The body is read
 * from a clone, so the controller still receives it unread.
 */
async function isSigned(request: Request, secret: string): Promise<boolean> {
	let header = request.headers.get("x-hub-signature-256");
	if (!header?.startsWith(SIGNATURE_PREFIX)) return false;

	let body = await request
		.clone()
		.text()
		.catch(() => null);
	if (body === null) return false;

	let signature = header.slice(SIGNATURE_PREFIX.length);
	let verified = await hmac.verify(secret, body, signature, { hash: "SHA-256" });
	return isSuccess(verified) && verified.data;
}

/**
 * Creates the check a GitHub webhook route runs behind.
 *
 * @param secret The hook's secret. An unset one refuses every delivery, so a worker
 * deployed without it fails closed.
 * @returns Middleware that answers `401` to an unsigned or mis-signed delivery.
 */
export default function githubWebhook(secret: string | undefined): Middleware {
	return async (ctx, next) => {
		if (secret && (await isSigned(ctx.request, secret))) return next();
		ctx.log.set({ githubWebhook: { rejected: secret ? "signature" : "missing_secret" } });
		return new Response(null, { status: 401 });
	};
}
