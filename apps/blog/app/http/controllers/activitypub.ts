/**
 * The ActivityPub documents of the blog's one actor: the actor itself, its outbox of
 * published posts, and its followers and following collections, all answered by the
 * federation, which serves these URLs as ActivityStreams alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Federation } from "@sdxc/activitypub";

import { createController } from "remix/router";

import routes from "~/routes/web";

/**
 * Hands the request to the federation, which answers the actor's own URLs: documents
 * with an `ETag` and `304` revalidation, `503` while a store fails, and the inbox's
 * verdict on a POST. A URL the federation does not own answers an empty `404`.
 *
 * @param ctx The request context carrying `ctx.activityPub`.
 */
export async function federate(ctx: {
	request: Request;
	activityPub: Federation;
}): Promise<Response> {
	let response = await ctx.activityPub.fetch(ctx.request);
	return response ?? new Response(null, { status: 404 });
}

/** Serves the actor and its collections, each answered whole by the federation. */
export default createController(routes.activityPub.documents, {
	actions: {
		/** The actor document a follow, a WebFinger lookup and every signature check read. */
		actor: federate,
		/** The posts as their `Create`s, newest first, `?page=true` for the pages. */
		outbox: federate,
		/** The count of accepted followers and the pages listing them. */
		followers: federate,
		/** Always empty: the blog's actor follows nobody. */
		following: federate,
	},
});
