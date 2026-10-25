/**
 * The `cloudflare:workers` module under Vitest, which runs the app's modules in Node: the
 * development secrets `.env.example` lists, so a module reading `env` at import loads as under
 * `bun dev`, and in-memory bindings that behave like Cloudflare's, so `DB` runs real SQL.
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

/**
 * The base class a Durable Object extends, holding the state and `env` it is constructed with,
 * so a test builds one with `createDurableObjectState()` from `@sdxc/cloudflare-mocks`.
 */
export class DurableObject<Env = Cloudflare.Env> {
	ctx: DurableObjectState;
	env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		this.ctx = ctx;
		this.env = env;
	}
}
