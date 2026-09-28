/**
 * Cloudflare configuration for the demo board, read by `cf` and the Vite plugin alike.
 * The board runs from a laptop, so the D1 id is a placeholder and every binding resolves
 * to its local simulation; the secrets are declared here so `env` is typed from this file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
	worker: {
		name: "demo",
		compatibilityDate: "2026-09-02",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		workersDev: false,
		observability: { enabled: true },
		/**
		 * Expires postings older than thirty days. The trigger enqueues the job and returns, so
		 * the sweep runs through the same dispatcher, logging and retries an enqueued job gets.
		 */
		triggers: [triggers.scheduled({ schedule: "0 3 * * *" })],
		env: {
			/**
			 * The board's postings, read by the list, the MCP tools and the expiry sweep.
			 * `bun run db:local:migrate` applies `database/migrations/` to the local copy, the
			 * only copy this app has: it answers no traffic outside the laptop it runs on.
			 */
			DB: bindings.d1({ name: "demo", id: "00000000-0000-4000-8000-000000000000" }),
			/**
			 * Both Turnstile keys are optional: setting them moves the captcha onto Cloudflare's
			 * challenge, and leaving them unset keeps the board on the local one.
			 */
			TURNSTILE_SECRET_KEY: bindings.secret(),
			TURNSTILE_SITE_KEY: bindings.secret(),
		},
	},
});
