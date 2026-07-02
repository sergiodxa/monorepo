import { ServiceContainer } from "@pkg/service-container";

import { DatabaseService } from "~/app/services/database";
import { IdTokenVerificationKeyProvider } from "~/app/services/id-token-verification-key";

import createApplication from "./app";

let container = new ServiceContainer();
let providers = [new DatabaseService(), new IdTokenVerificationKeyProvider()];

for (let provider of providers) provider.register(container);

/**
 * Handles incoming Worker requests by creating the app router with
 * environment-backed dependencies and forwarding the request to it.
 */
export default {
	async fetch(request: Request, env: Cloudflare.Env) {
		return container.scope(async () => {
			let IS_PROD = resolveIsProd(request);

			let [CLIENT_ID, CLIENT_SECRET, COOKIE_SESSION_SECRET] = await Promise.all([
				env.CLIENT_ID.get(),
				env.CLIENT_SECRET.get(),
				env.COOKIE_SESSION_SECRET.get(),
			]);

			let router = createApplication({
				IS_PROD,
				CLIENT_ID,
				CLIENT_SECRET,
				COOKIE_SESSION_SECRET,
				AUTH: env.AUTH,
				REDIRECTS: env.REDIRECTS,
			});

			return await router.fetch(request);
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;

function resolveIsProd(request: Request) {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}
