/**
 * Reads the `__Host-session` cookie a hosted screen's request carries, if any, and
 * resolves it against the tenant, and serializes the cookie a sign-in just opened.
 * A browser carries at most one of these cookies today, so every caller here
 * deals in zero or one session id, never a list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { requestOrigin } from "~/app/lib/request-origin";
import { sessionCookie } from "~/app/lib/session-cookie";

/**
 * Resolves the request's session cookie to its live session and subject id, when
 * it carries one that still resolves as `"active"`.
 *
 * @param ctx - The request context (provides `request` and `tenantStub`).
 * @returns The live session and subject id, or `null` when there is no cookie or
 * it no longer resolves.
 */
export async function activeSession(
	ctx: RequestContext,
): Promise<{ sessionId: string; subjectId: string } | null> {
	let token = await sessionCookie.parse(ctx.request.headers.get("Cookie"));
	if (!token) return null;

	let resolved = await ctx.tenantStub.resolveSession({ token, ...requestOrigin(ctx.request) });
	return resolved.status === "active"
		? { sessionId: resolved.sessionId, subjectId: resolved.subjectId }
		: null;
}

/**
 * Resolves the request's session cookie to a live session id, when it carries one
 * that still resolves as `"active"`.
 *
 * @param ctx - The request context (provides `request` and `tenantStub`).
 * @returns The live session id, or `null` when there is no cookie or it no longer
 * resolves.
 */
export async function activeSessionId(ctx: RequestContext): Promise<string | null> {
	return (await activeSession(ctx))?.sessionId ?? null;
}

/** What a `signInWithPassword`/`signInWithPasskey` call hands back to open a session from. */
export interface OpenedSession {
	token: string;
	expiresAt: number;
}

/**
 * Serializes the `__Host-session` cookie for a session a sign-in just opened. A
 * remembered session's `Max-Age` runs to the session's own absolute lifetime; an
 * unremembered one carries none, so the browser clears the cookie when it closes.
 *
 * @param session - The token and absolute expiry `openSession` minted.
 * @param remembered - Whether the browser should keep the session past its own lifetime.
 * @returns The `Set-Cookie` header value to append to the response.
 */
export function serializeSessionCookie(
	session: OpenedSession,
	remembered: boolean,
): Promise<string> {
	if (!remembered) return sessionCookie.serialize(session.token, {});

	let maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
	return sessionCookie.serialize(session.token, { maxAge });
}
