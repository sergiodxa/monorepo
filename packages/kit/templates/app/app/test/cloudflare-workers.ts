/**
 * The `cloudflare:workers` module under Vitest, which imports the app's modules in Node, outside
 * the Worker runtime. It carries the development secrets `.env.example` lists, so a module that
 * reads `env` at import loads the same way it does under `bun dev`.
 */

/** The secrets the app reads, with the values a project starts with for development. */
export const env = {
	HONEYPOT_SECRET: "development-honeypot-secret",
	TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as Partial<Cloudflare.Env> as Cloudflare.Env;
