/**
 * Cloudflare deployment configuration for the sdxc worker, read by `cf` and the Vite
 * plugin alike. Secrets are declared here so type generation and local dev validation
 * both come from this file, with values supplied by `.dev.vars` and `cf`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
	worker: {
		name: "sdxc",
		compatibilityDate: "2026-09-02",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		workersDev: true,
		placement: { mode: "smart" },
		/**
		 * Traces are head-sampled at 10%: this is a public documentation site whose pages
		 * take crawler and agent traffic, so full tracing is mostly noise.
		 */
		observability: {
			enabled: true,
			traces: { enabled: true, headSamplingRate: 0.1 },
		},
		/**
		 * The custom domains are declared here so a deploy never drops one; rollback is
		 * redeploying the previous version rather than moving a domain. `sdxc.dev` is the
		 * site's address, and `sdxc.sergiodxa.com` stays attached so its links redirect there.
		 */
		domains: ["sdxc.dev", "sdxc.sergiodxa.com"],
		/**
		 * The sponsor list is read into KV on a schedule, so a page never waits on GitHub and
		 * an outage there leaves the previous list standing. GitHub's sponsorship webhook
		 * refreshes it as soon as a sponsor changes, so the weekly run only catches a missed
		 * delivery.
		 */
		triggers: [triggers.scheduled({ schedule: "0 5 * * 1" })],
		/**
		 * `CACHE` holds what the site reads back from GitHub — the changelog, and who funds
		 * the work; the rest renders from the deploy, and each page serves its cached copy
		 * when a call fails. A deploy keeps exactly the secrets declared here, so
		 * `GITHUB_TOKEN`, which the sponsor refresh needs, and the secret GitHub signs
		 * sponsorship webhooks with both survive every release.
		 */
		env: {
			CACHE: bindings.kv({ id: "006c6214d1d6469787114fe5b30e6e41" }),
			/**
			 * Every page's rendered social card, keyed by template and content, so a card is
			 * drawn once and served from storage after that. The bucket is shared with the
			 * author's blog; this site's cards live under `sdxc/`.
			 */
			SOCIAL_CARDS: bindings.r2({ name: "social-cards" }),
			/** The deployed version's id, which `/health` reports so a report names its deploy. */
			CF_VERSION_METADATA: bindings.versionMetadata(),
			GITHUB_TOKEN: bindings.secret(),
			GITHUB_SPONSORS_WEBHOOK_SECRET: bindings.secret(),
		},
	},
});
