/**
 * Cloudflare deployment configuration for the books worker, read by `cf` and the
 * Vite plugin alike. Secrets are declared here so type generation and local dev
 * validation both come from this file, with values supplied by `.dev.vars` and `cf`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		/**
		 * This app deploys *as* the `books` worker, so the custom domain, its secrets, and
		 * the Polar webhook URL registered against the domain all belong to this name.
		 * Rollback is redeploying the previous version.
		 */
		name: "books",
		compatibilityDate: "2026-09-02",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		workersDev: true,
		placement: { mode: "smart" },
		/**
		 * Traces are head-sampled at 10%: this is a marketing funnel whose homepage takes
		 * bot and crawler traffic, so full tracing is mostly noise.
		 */
		observability: {
			enabled: true,
			traces: { enabled: true, headSamplingRate: 0.1 },
		},
		domains: ["books.sergiodxa.com"],
		/**
		 * The worker keeps no storage of its own; its state lives in Buttondown and Polar.
		 * Buttondown picks a response shape per request from `x-api-version`, so the pinned
		 * version is what keeps a provider release from changing what this app parses.
		 */
		env: {
			BUTTONDOWN_API_VERSION: bindings.text("2024-07-01"),
			BUTTONDOWN_API_KEY: bindings.secret(),
			POLAR_ACCESS_TOKEN: bindings.secret(),
			POLAR_WEBHOOK_SECRET: bindings.secret(),
		},
	},
});
