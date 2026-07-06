/**
 * Cloudflare bindings accessor for the blog app. Defines the router context that
 * carries the Worker's env, execution context, and request cf data, and exposes
 * getBindings() which returns a structured view of the D1 database, KV
 * namespaces, R2 backups, waitUntil, and a Zod-validated set of required env
 * secrets. This centralizes typed access to platform resources.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContext } from "react-router";
import { z } from "zod";

import { getContext } from "./context-storage";

export const CloudflareContext = createContext<{
	env: Cloudflare.Env;
	ctx: ExecutionContext;
	cf?: RequestInitCfProperties;
}>();

export function getBindings() {
	let { env, ctx, cf } = getContext().get(CloudflareContext);

	return {
		cf,
		fs: { backups: env.BACKUPS },
		db: env.DB,
		kv: {
			cache: env.CACHE,
			auth: env.AUTH,
			redirects: env.REDIRECTS,
		},
		waitUntil: ctx.waitUntil.bind(ctx),
		env: z
			.object({
				COOKIE_SESSION_SECRET: z.string().min(1),
				GITHUB_CLIENT_ID: z.string().min(1),
				GITHUB_CLIENT_SECRET: z.string().min(1),
				GH_APP_ID: z.string().min(1),
				GH_APP_PEM: z.string().min(1),
			})
			.parse(env),
	};
}
