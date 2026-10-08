/**
 * Cloudflare deployment configuration for the `auth` worker, read by `cf` and the Vite
 * plugin alike. Every binding, trigger and secret the authorization server reads is
 * declared here, so `env` types and local dev validation both come from this file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig(({ mode }) => ({
	worker: {
		/**
		 * This app deploys *as* the `auth` worker, so one worker keeps the hostname, the queue
		 * role and the secrets already set on it, and a bad release is undone by rolling the
		 * worker back to its previous version.
		 */
		name: "auth",
		compatibilityDate: "2026-09-02",
		/**
		 * Node built-ins must resolve: the billing and JWT dependencies reach for them, so
		 * dropping the flag is a change to verify on its own.
		 */
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./bootstrap/worker.ts",
		workersDev: true,
		placement: { mode: "off" },
		observability: { enabled: true },
		/**
		 * The hostname every relying party has hardcoded, and the one the issuer claims. It
		 * lives with the worker that answers it, and a deploy claiming a hostname another
		 * worker still holds is refused, so this line and that release are the same step.
		 */
		domains: ["auth.sergiodxa.com"],
		triggers: [
			/**
			 * Enqueues the expired-session sweep at midnight UTC. Paired with the `auth` consumer
			 * below, which is what reads the message this publishes.
			 */
			triggers.scheduled({ schedule: "0 0 * * *" }),
			/**
			 * A Cloudflare queue has exactly one consumer, so this worker owns the role. Three
			 * deliveries are the sweep's whole budget; a message that spends them lands in
			 * `auth-dlq`, so a failing night leaves a record.
			 */
			triggers.queue({ name: "auth", deadLetterQueue: "auth-dlq", maxRetries: 3 }),
			/** Consumes the dead-letter queue so what `auth` gave up on is recorded and acked. */
			triggers.queue({ name: "auth-dlq" }),
		],
		env: {
			DB: bindings.d1({ name: "auth", id: "1549b30f-b4ba-48b0-b08a-76b8003a37db" }),
			KV: bindings.kv({ id: "848d0b8592b64956999bc9769bee6c8e" }),
			/**
			 * Holds the ES256 signing key pair. Every worker issuing tokens for this issuer must
			 * read the same file, or tokens stop verifying against the published JWKS.
			 */
			R2: bindings.r2({ name: "auth" }),
			/** Publishes the daily sweep the cron enqueues onto the queue this worker consumes. */
			QUEUE: bindings.queue({ name: "auth" }),
			/**
			 * Writes a body the dispatcher can never read straight to the dead-letter queue, so
			 * the three deliveries stay available for the failures a retry does fix.
			 */
			DLQ: bindings.queue({ name: "auth-dlq" }),
			/**
			 * Every message goes to a subject's own address, so it accepts any verified sender
			 * and destination. Local dev sends remotely, which bills and delivers like
			 * production, because only a real send exercises sender verification and limits.
			 */
			EMAIL: bindings.sendEmail({ dev: { remote: true } }),
			/**
			 * Read only while provisioning a brand-new subject, from the account's store. A first
			 * sign-in completes when the read fails, since the billing mirror is best effort.
			 */
			POLAR_ACCESS_TOKEN: bindings.secretsStoreSecret({
				storeId: "e8d9e39c4db6485bbd65a9658e8f9a71",
				secretName: "POLAR_ACCESS_TOKEN",
			}),
			/**
			 * Token endpoint: 20 requests per minute per client. Every limit below is also
			 * declared to the adapters in `app/services/rate-limiters.ts`, which is what makes
			 * the `RateLimit` response headers truthful, so keep the two in step.
			 */
			TOKEN_RATE_LIMITER: bindings.rateLimit({
				namespace: "1001",
				simple: { limit: 20, period: 60 },
			}),
			/** Introspection endpoint: 100 requests per minute per client. */
			INTROSPECT_RATE_LIMITER: bindings.rateLimit({
				namespace: "1002",
				simple: { limit: 100, period: 60 },
			}),
			/** Revocation endpoint: 50 requests per minute per client. */
			REVOKE_RATE_LIMITER: bindings.rateLimit({
				namespace: "1003",
				simple: { limit: 50, period: 60 },
			}),
			/**
			 * Authorization endpoint: 30 requests per minute per IP. A development server allows
			 * ten times that, since the executable spec suite drives every sign-in from one address.
			 */
			AUTHORIZE_RATE_LIMITER: bindings.rateLimit({
				namespace: "1004",
				simple: { limit: mode === "production" ? 30 : 300, period: 60 },
			}),
			/** Login routes: 10 requests per minute per IP, the strictest budget; 100 in development. */
			LOGIN_RATE_LIMITER: bindings.rateLimit({
				namespace: "1005",
				simple: { limit: mode === "production" ? 10 : 100, period: 60 },
			}),
			/**
			 * Plain secrets, read on ordinary requests, so each one needs a local value too:
			 * `.dev.vars` in development, `cf workers secrets` in production.
			 */
			COOKIE_SESSION_SECRET: bindings.secret(),
			GITHUB_CLIENT_ID: bindings.secret(),
			GITHUB_CLIENT_SECRET: bindings.secret(),
			UPTIME_CRON_API_KEY: bindings.secret(),
			/**
			 * Stands in for the Secrets Store binding, which has no local value. Declared outside
			 * production builds only, so a deploy requires no worker secret of this name.
			 */
			...(mode === "production" ? {} : { POLAR_ACCESS_TOKEN_LOCAL: bindings.secret() }),
		},
	},
}));
