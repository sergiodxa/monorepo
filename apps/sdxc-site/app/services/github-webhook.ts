/**
 * Authenticates a GitHub webhook delivery. GitHub signs every body with the hook's secret
 * and sends the HMAC as `X-Hub-Signature-256`; only a body that matches it is ever read, so
 * an anonymous `POST` to a webhook address never reaches the work behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { hmac } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

/** How GitHub prefixes the hex HMAC-SHA256 in `X-Hub-Signature-256`. */
const SIGNATURE_PREFIX = "sha256=";

/**
 * Verifies `request` against `secret`, reading its body once.
 *
 * @param request The delivery, with its body still unread.
 * @param secret The hook's secret. An unset one refuses every delivery, so a worker
 * deployed without it fails closed.
 * @returns The event the delivery reports, from `X-GitHub-Event` (`ping` when the hook is
 * created), or why it was refused.
 */
export async function verifyGitHubDelivery(
	request: Request,
	secret: string | undefined,
): Promise<Result<string, Error>> {
	if (!secret) return failure(new Error("No webhook secret is configured"));

	let header = request.headers.get("x-hub-signature-256");
	if (!header?.startsWith(SIGNATURE_PREFIX)) {
		return failure(new Error("The delivery carries no X-Hub-Signature-256"));
	}

	let body = await request.text().catch(() => null);
	if (body === null) return failure(new Error("The delivery body could not be read"));

	let signature = header.slice(SIGNATURE_PREFIX.length);
	let verified = await hmac.verify(secret, body, signature, { hash: "SHA-256" });
	if (isFailure(verified)) return failure(verified.error);
	if (!verified.data) return failure(new Error("The signature does not match the body"));

	return success(request.headers.get("x-github-event") ?? "");
}
