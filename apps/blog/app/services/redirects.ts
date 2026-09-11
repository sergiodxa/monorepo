/**
 * Redirects service for blog. Wraps the REDIRECTS KV namespace behind the
 * Redirect repository, exposing path lookup, listing, upsert, and delete
 * operations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { Redirect } from "~/app/repositories/redirect";

/** Wraps the REDIRECTS KV namespace behind app-level redirect operations. */
export class RedirectsService {
	findByPath(pathname: string) {
		return Redirect.findByPath(env.REDIRECTS, pathname);
	}

	findAll() {
		return Redirect.findAll(env.REDIRECTS);
	}

	upsert(input: Redirect.UpsertInput) {
		return Redirect.upsert(env.REDIRECTS, input);
	}

	destroy(from: string) {
		return Redirect.destroy(env.REDIRECTS, from);
	}
}

let instance: RedirectsService | undefined;

/**
 * Opens the redirect rules the request path is matched against.
 *
 * @returns The isolate's service, built on the first call and reused after it.
 * @example
 * let rule = await createRedirectsService().findByPath(ctx.url.pathname);
 */
export function createRedirectsService(): RedirectsService {
	return (instance ??= new RedirectsService());
}
