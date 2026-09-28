/**
 * Cloudflare deployment configuration for the blog-saas worker, read by `cf` and the
 * Vite plugin alike. Every binding and secret the worker reads is declared here, so
 * `env` types and local dev both come from this file, with values from `.dev.vars` and `cf`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bindings, defineConfig, exports, triggers } from "cf/config";

export default defineConfig({
	worker: {
		name: "blog-saas",
		compatibilityDate: "2026-09-02",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		workersDev: true,
		observability: { enabled: true },
		/**
		 * One-time zone setup outside this config: a proxied wildcard `*.blog.sergiodxa.com`,
		 * a proxied `fallback.blog.sergiodxa.com` set as the CF for SaaS fallback origin, and
		 * an explicit `sso.blog.sergiodxa.com/*` route to the auth-saas worker.
		 */
		domains: ["blog.sergiodxa.com"],
		/**
		 * 01:00 UTC aggregates page views into `usage_daily` for Polar ingestion; 02:00 UTC purges
		 * soft-deleted blogs past retention and polls pending hostnames. Each cron only enqueues
		 * its jobs, and a batch size of 1 gives every job its own full wall-clock budget.
		 */
		triggers: [
			triggers.fetch({ pattern: "*.blog.sergiodxa.com/*", zone: "sergiodxa.com" }),
			triggers.fetch({ pattern: "fallback.blog.sergiodxa.com/*", zone: "sergiodxa.com" }),
			triggers.scheduled({ schedule: "0 1 * * *" }),
			triggers.scheduled({ schedule: "0 2 * * *" }),
			triggers.queue({ name: "blog-saas-jobs", maxBatchSize: 1, maxRetries: 3 }),
		],
		/**
		 * Each blog is one SQLite-backed `Blog` Durable Object, addressed by blog id through
		 * `env.BLOG`.
		 */
		exports: {
			Blog: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			PLATFORM_DOMAIN: bindings.text("blog.sergiodxa.com"),
			OIDC_ISSUER: bindings.text("https://sso.blog.sergiodxa.com"),
			/**
			 * Serves the Vite client build, which the platform domain answers from before
			 * falling through to the dashboard router.
			 */
			ASSETS: bindings.assets(),
			BLOG: bindings.durableObject({ worker: "blog-saas", exportName: "Blog" }),
			/**
			 * `cf d1 migrations apply` takes this ID, so the placeholder is UUID-shaped; the
			 * `db:*:migrate` scripts repeat it with `--dir ./database/migrations`, and local dev
			 * keys its database on the same ID.
			 */
			PLATFORM_DB: bindings.d1({
				name: "blog-saas-platform",
				id: "00000000-0000-4000-8000-000000000000",
			}),
			SLUG_CACHE: bindings.kv({ id: "placeholder-slug-cache-id" }),
			ANALYTICS: bindings.analyticsEngineDataset({ name: "blog-saas-analytics" }),
			/**
			 * The queue must exist (`cf queues create blog-saas-jobs`) before a deploy references it.
			 * Three retries cover a transient D1, Cloudflare API, or Polar failure; jobs are idempotent,
			 * rerun on the next day's cron, and the dispatcher logs `job.failed` for one out of retries.
			 */
			QUEUE: bindings.queue({ name: "blog-saas-jobs" }),
			/** Signs the dashboard session cookie. */
			COOKIE_SESSION_SECRET: bindings.secret(),
			/** The dashboard's OIDC client on the sso tenant. */
			OIDC_CLIENT_ID: bindings.secret(),
			OIDC_CLIENT_SECRET: bindings.secret(),
			/** The management (M2M) client that provisions a per-blog OIDC client on the sso tenant. */
			SSO_MANAGEMENT_CLIENT_ID: bindings.secret(),
			SSO_MANAGEMENT_CLIENT_SECRET: bindings.secret(),
			/** CF for SaaS custom hostnames and the Analytics Engine SQL API. */
			CF_API_TOKEN: bindings.secret(),
			CF_ZONE_ID: bindings.secret(),
			CF_ACCOUNT_ID: bindings.secret(),
			POLAR_ACCESS_TOKEN: bindings.secret(),
			POLAR_WEBHOOK_SECRET: bindings.secret(),
			POLAR_PRODUCT_ID: bindings.secret(),
		},
	},
});
