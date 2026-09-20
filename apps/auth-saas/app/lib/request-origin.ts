/**
 * The bits of a request's origin `openSession`/`resolveSession` record alongside a
 * session: the connecting IP and `User-Agent`, and the coarse geography Cloudflare
 * already resolved for the request, with no lookup of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getClientIP } from "@sdxc/get-client-ip";

/** The origin fields every session-opening and session-resolving call accepts. */
export interface RequestOrigin {
	ip: string | null;
	userAgent: string | null;
	country: string | null;
	region: string | null;
	city: string | null;
}

/**
 * Reads a request's connecting IP, `User-Agent` and Cloudflare-resolved geography.
 *
 * @param request - The incoming request.
 * @returns The origin fields to spread into an `openSession`/`resolveSession` call.
 */
export function requestOrigin(request: Request): RequestOrigin {
	let cf = request.cf as IncomingRequestCfProperties | undefined;

	return {
		ip: getClientIP(request),
		userAgent: request.headers.get("User-Agent"),
		country: cf?.country ?? null,
		region: cf?.region ?? null,
		city: cf?.city ?? null,
	};
}
