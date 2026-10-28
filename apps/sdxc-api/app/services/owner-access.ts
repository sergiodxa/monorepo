/**
 * Operator free pass for priced routes: a Bearer token matching the
 * `OWNER_ACCESS_TOKEN` secret skips x402. Everyone else still pays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { timingSafeEqual } from "@sdxc/crypto";
import { env } from "cloudflare:workers";

/** `Authorization: Bearer <token>` carrying the operator secret. */
const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/**
 * Whether this request presents the operator's access token.
 *
 * An unset or empty `OWNER_ACCESS_TOKEN` never matches, so a missing secret
 * fails closed (every caller still pays). A wrong Bearer still pays rather than
 * answering 401, so probing does not reveal whether the secret is set.
 *
 * @param request - Incoming HTTP request
 */
export function isOwnerRequest(request: Request): boolean {
	let expected = ownerAccessToken();
	if (expected === null) return false;

	let header = request.headers.get("Authorization");
	if (header === null) return false;

	let match = BEARER_PATTERN.exec(header.trim());
	if (match === null) return false;

	return timingSafeEqual(expected, match[1]!);
}

/**
 * The configured operator token, or `null` when unset so bypass stays off.
 */
function ownerAccessToken(): string | null {
	try {
		let value = env.OWNER_ACCESS_TOKEN;
		if (typeof value !== "string") return null;
		let trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	} catch {
		return null;
	}
}
