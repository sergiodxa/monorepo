/**
 * Cloudflare configuration for the Worker, read by `cf` and the Vite plugin alike. Every
 * binding and trigger the app reads is declared here, so `sdxc run typegen` types `env` from
 * this file and local development simulates exactly what production provides.
 */

import { bindings, defineConfig, triggers } from "cf/config";

import manifest from "./package.json" with { type: "json" };

export default defineConfig({
	worker: {
		name: manifest.name,
		compatibilityDate: "2026-09-02",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		observability: { enabled: true },
		/**
		 * A queue has exactly one consumer, so this Worker owns the role: every job the
		 * dispatcher enqueues is delivered back here and run through the same dispatcher.
		 */
		triggers: [triggers.queue({ name: manifest.name })],
		env: {
			/**
			 * The app's database. `cf d1 create <name>` prints the id to put here, where the
			 * `sdxc run db` commands read it; until then, `bun dev` runs on a local copy.
			 */
			DB: bindings.d1({ name: manifest.name, id: "00000000-0000-4000-8000-000000000000" }),
			/**
			 * Sends the app's email. Cloudflare delivers only from an address on a domain with Email
			 * Routing enabled, so set `MAIL_FROM` in `config/constants.ts` to one before deploying.
			 */
			EMAIL: bindings.sendEmail(),
			/** Where the job dispatcher enqueues; `cf queues create <name>` before the first deploy. */
			QUEUE: bindings.queue({ name: manifest.name }),
			/**
			 * 100 requests per minute per client address, across every route. The router's
			 * adapter declares the same budget for the `RateLimit` headers; keep the two in step.
			 */
			RATE_LIMITER: bindings.rateLimit({ namespace: "1001", simple: { limit: 100, period: 60 } }),
			/**
			 * Visitors' sessions. `cf kv namespace create <name>` prints the id to put here; until
			 * then, `bun dev` keeps sessions in a local copy.
			 */
			SESSIONS: bindings.kv({ id: "00000000000000000000000000000000" }),
			/** Signs the session cookie. */
			SESSION_SECRET: bindings.secret(),
			/** Signs the honeypot fields every page form carries. */
			HONEYPOT_SECRET: bindings.secret(),
			/** The Turnstile widget's site key, which a form renders. */
			TURNSTILE_SITE_KEY: bindings.secret(),
			/** Verifies the Turnstile token a form submits. */
			TURNSTILE_SECRET_KEY: bindings.secret(),
		},
	},
});
