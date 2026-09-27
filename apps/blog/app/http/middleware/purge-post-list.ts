/**
 * Invalidates the shared post-list tag after any CMS write. It sits on the
 * resource routes rather than inside each action so a new content type cannot
 * ship with a stale listing: forgetting one call site is the failure this exists
 * to make impossible, and over-purging one tag costs a single re-render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { TAGS } from "~/app/services/cache";

/** Methods that can change what a listing would render. */
const WRITE_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Whether a CMS request stored a change. Success is the redirect every mutating action
 * answers with, which is what separates a stored change from a rejected form re-rendered
 * in place.
 *
 * @param method The request method.
 * @param response What the action answered.
 */
export function isStoredWrite(method: string, response: Response): boolean {
	return WRITE_METHODS.has(method.toUpperCase()) && response.status >= 300 && response.status < 400;
}

/** Purges the post-list tag once a CMS write succeeds. */
const purgePostList: Middleware = async (ctx, next) => {
	let response = await next();
	if (isStoredWrite(ctx.method, response)) ctx.cache.purgeLater(TAGS.postList());
	return response;
};

export default purgePostList;
