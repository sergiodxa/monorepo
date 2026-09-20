/**
 * Absolute hosted-page links a message carries, built on the resolved tenant's own
 * issuer rather than the request's host — the message may be read on a different
 * device than the one that requested it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import routes from "~/routes/tenant";

/**
 * Builds `/u/verify`'s absolute link for a verification ticket.
 *
 * @param ctx - The request context (provides `tenant`).
 * @param ticket - The ticket `addIdentifier` minted for the address.
 * @returns The link to send.
 */
export function verifyAddressLink(ctx: RequestContext, ticket: string): string {
	let url = new URL(routes.hostedVerifyShow.href(), ctx.tenant.issuer);
	url.searchParams.set("ticket", ticket);
	return url.toString();
}

/**
 * Builds `/u/reset`'s absolute link for a password reset ticket.
 *
 * @param ctx - The request context (provides `tenant`).
 * @param ticket - The ticket `beginPasswordReset` minted for the address.
 * @returns The link to send.
 */
export function resetPasswordLink(ctx: RequestContext, ticket: string): string {
	let url = new URL(routes.hostedResetShow.href(), ctx.tenant.issuer);
	url.searchParams.set("ticket", ticket);
	return url.toString();
}
