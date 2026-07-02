import type { Container, ServiceProvider } from "@pkg/service-container";

import { env } from "cloudflare:workers";

import { Redirect } from "~/app/repositories/redirect";

/** Wraps the REDIRECTS KV namespace behind app-level redirect operations. */
export class RedirectsService {
	/** Resolves one redirect rule for the provided pathname. */
	findByPath(pathname: string) {
		return Redirect.findByPath(env.REDIRECTS, pathname);
	}

	/** Lists every redirect entry available to the CMS. */
	findAll() {
		return Redirect.findAll(env.REDIRECTS);
	}

	/** Creates or updates one redirect rule in KV. */
	upsert(input: Redirect.UpsertInput) {
		return Redirect.upsert(env.REDIRECTS, input);
	}

	/** Deletes one redirect rule by normalized source path. */
	destroy(from: string) {
		return Redirect.destroy(env.REDIRECTS, from);
	}
}

/** Registers the redirects service as an application singleton. */
export class RedirectsServiceProvider implements ServiceProvider {
	/** Stores the redirects service in the application container. */
	register(container: Container) {
		container.singleton(RedirectsService, () => new RedirectsService());
	}
}
