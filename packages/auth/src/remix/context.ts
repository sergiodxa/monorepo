/**
 * The two reads that connect a Remix request to the session-backed classes: the
 * session the `remix/middleware/session` middleware stored on the request context, and
 * the request-plus-session pair the browser flow's route methods take.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Session } from "remix/session";

import type { AuthSession } from "../auth-session.js";
import type { RelyingParty } from "../relying-party.js";

/**
 * The part of a request context the two reads use, which every flavor of the router's
 * `RequestContext` carries whatever entries its middleware chain has added.
 */
export interface RequestContextSource {
	/** The request the route received. */
	readonly request: Request;
	/**
	 * Reads a value the middleware chain stored.
	 *
	 * @param key - The context key to read.
	 */
	get(key: typeof Session): Session | undefined;
}

/**
 * The session store a request carries, which is where the login transaction and the
 * token set live between requests.
 *
 * @param ctx - The request context the session middleware wrote to.
 * @returns The request's session, which satisfies the store the classes read.
 * @throws When the session middleware has not run, which every read and write of the
 *   token set goes through.
 * @example
 * let auth = AuthSession.from(sessionOf(ctx));
 */
export function sessionOf(ctx: RequestContextSource): AuthSession.Store {
	let session = ctx.get(Session);
	if (!session) {
		throw new Error("@sdxc/auth needs remix/middleware/session installed on the router");
	}
	return session;
}

/**
 * The request and its session store, in the shape the browser flow's route methods
 * take, so a route hands its context over in one call.
 *
 * @param ctx - The request context a route received.
 * @returns The request and the session store the flow writes to.
 * @throws When the session middleware has not run.
 * @example
 * router.get(routes.auth.login, (ctx) => rp.authorize(contextOf(ctx), { returnTo }));
 */
export function contextOf(ctx: RequestContextSource): RelyingParty.Context {
	return { request: ctx.request, session: sessionOf(ctx) };
}
