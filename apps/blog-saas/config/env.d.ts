/**
 * Widens the `Cloudflare.Env` that `bun run cf:typegen` generates from
 * `cloudflare.config.ts`: vars read as `string` so tests can run against other hosts,
 * and `POLAR_WEBHOOK_SECRET` is optional so the webhook fails closed when it is unset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare namespace Cloudflare {
	interface Env {
		BLOG: DurableObjectNamespace;
		PLATFORM_DB: D1Database;
		SLUG_CACHE: KVNamespace;
		ANALYTICS: AnalyticsEngineDataset;
		ASSETS: Fetcher;
		QUEUE: Queue;

		PLATFORM_DOMAIN: string;
		OIDC_ISSUER: string;

		COOKIE_SESSION_SECRET: string;
		OIDC_CLIENT_ID: string;
		OIDC_CLIENT_SECRET: string;
		SSO_MANAGEMENT_CLIENT_ID: string;
		SSO_MANAGEMENT_CLIENT_SECRET: string;
		CF_API_TOKEN: string;
		CF_ZONE_ID: string;
		CF_ACCOUNT_ID: string;
		POLAR_ACCESS_TOKEN: string;
		POLAR_WEBHOOK_SECRET?: string;
		POLAR_PRODUCT_ID: string;
	}
}
