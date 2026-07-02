import type { Container, ServiceProvider } from "@pkg/service-container";

import { env } from "cloudflare:workers";

import { createProvider } from "~/app/auth/services/oauth";
import routes from "~/routes/web";

/** Builds the configured OIDC provider for the current auth request. */
export class OAuthProviderService {
	/** Creates the sergiodxa auth provider using the active request origin and env credentials. */
	async create(requestUrl: string) {
		return createProvider({
			auth: {
				clientId: await env.CLIENT_ID.get(),
				clientSecret: await env.CLIENT_SECRET.get(),
			},
			redirectUri: new URL(routes.auth.callback.href(), requestUrl).toString(),
		});
	}
}

/** Registers the OAuth provider factory as an application singleton. */
export class OAuthProviderServiceProvider implements ServiceProvider {
	/** Stores the OAuth provider factory in the application container. */
	register(container: Container) {
		container.singleton(OAuthProviderService, () => new OAuthProviderService());
	}
}
