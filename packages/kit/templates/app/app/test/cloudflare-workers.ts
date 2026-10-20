/**
 * The `cloudflare:workers` module under Vitest, which imports the app's modules in Node, outside
 * the Worker runtime. It carries the development secrets `.env.example` lists, so a module that
 * reads `env` at import loads the same way it does under `bun dev`. Its bindings are in-memory
 * stand-ins that behave like Cloudflare's, so a test reads and writes real SQL through `DB`.
 */

import {
	createD1Database,
	createKVNamespace,
	createQueue,
	createRateLimit,
	createSendEmail,
} from "@sdxc/cloudflare-mocks";

/** The bindings and secrets the app reads, with the values a project starts with for development. */
export const env = {
	DB: createD1Database(),
	EMAIL: createSendEmail(),
	QUEUE: createQueue(),
	RATE_LIMITER: createRateLimit(),
	SESSIONS: createKVNamespace(),
	SESSION_SECRET: "development-session-secret",
	HONEYPOT_SECRET: "development-honeypot-secret",
	TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as Partial<Cloudflare.Env> as Cloudflare.Env;
