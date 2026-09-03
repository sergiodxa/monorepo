/**
 * Cloudflare Worker fetch entrypoint for blog. Registers the service-container
 * providers once, then per request opens a container scope, resolves secrets and
 * bindings from the environment, and forwards the request to the app router.
 *
 * `waitUntil` is passed through as part of the environment so a deferred cache write
 * outlives the response it was computed for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ServiceProvider } from "@sdxc/service-container";

import { ServiceContainer } from "@sdxc/service-container";

import { DatabaseService } from "~/app/services/database";
import { LoggerServiceProvider } from "~/app/services/logger";
import { RedirectsServiceProvider } from "~/app/services/redirects";

import createApplication from "./app";

let container = new ServiceContainer();
let providers: ServiceProvider[] = [
	new DatabaseService(),
	new LoggerServiceProvider(),
	new RedirectsServiceProvider(),
];

for (let provider of providers) provider.register(container);

/**
 * Runs each request inside its own container scope, keeping its resolved
 * service instances isolated from every other in-flight request.
 */
export default {
	async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
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
				CACHE: env.CACHE,
				MCP_RATE_LIMITER: env.MCP_RATE_LIMITER,
				waitUntil: (promise) => ctx.waitUntil(promise),
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
