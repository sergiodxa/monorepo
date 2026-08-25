/**
 * Redirects service for blog. Wraps the REDIRECTS KV namespace behind the
 * Redirect repository, exposing path lookup, listing, upsert, and delete
 * operations, and registers itself as an application-container singleton.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Container, ServiceProvider } from "@pkg/service-container";

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

/** Registers the redirects service as an application singleton. */
export class RedirectsServiceProvider implements ServiceProvider {
	register(container: Container) {
		container.singleton(RedirectsService, () => new RedirectsService());
	}
}
