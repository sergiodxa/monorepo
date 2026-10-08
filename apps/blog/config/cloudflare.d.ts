/**
 * Ambient Cloudflare runtime type declarations for blog. Defines the minimal
 * KV, D1, and Secrets Store contracts the app adapters rely on, the `Cloudflare.Env`
 * bindings from wrangler.jsonc, and the Worker `ExportedHandler` shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare global {
	/** Minimal Cloudflare KV contract used by app adapters and tests. */
	interface KVNamespace {
		get(key: string): Promise<string | null>;
		put(
			key: string,
			value: string | ArrayBuffer | ReadableStream | ArrayBufferView,
			options?: { expirationTtl?: number },
		): Promise<void>;
		delete(key: string): Promise<void>;
		list(): Promise<{ keys: Array<{ name: string }> }>;
	}

	/** Minimal Cloudflare D1 prepared statement contract used by the D1 adapter. */
	interface D1PreparedStatement {
		bind(...values: Array<unknown>): D1PreparedStatement;
		all<T = Record<string, unknown>>(): Promise<{
			results?: Array<T>;
			meta?: { changes?: number; last_row_id?: number };
		}>;
		run<T = Record<string, unknown>>(): Promise<{
			results?: Array<T>;
			meta?: { changes?: number; last_row_id?: number };
		}>;
	}

	/** Minimal Cloudflare D1 binding contract used by the D1 adapter. */
	interface D1Database {
		prepare(query: string): D1PreparedStatement;
		exec(query: string): Promise<void>;
	}

	/** Minimal Cloudflare Secrets Store binding used by the Worker bootstrap. */
	interface SecretsStoreSecret {
		get(): Promise<string>;
	}

	namespace Cloudflare {
		/** Runtime bindings declared in `wrangler.jsonc`. */
		interface Env {
			DB: D1Database;
			AUTH: KVNamespace;
			REDIRECTS: KVNamespace;
			CACHE: KVNamespace;
			/** Present only once a deploy's bindings include the `ratelimits` entry. */
			MCP_RATE_LIMITER?: RateLimit;
			/** Present only once a deploy's bindings include the `SUPPORT_RATE_LIMITER` entry. */
			SUPPORT_RATE_LIMITER?: RateLimit;
			/** Present only once a deploy's bindings include the `ACTIVITYPUB_RATE_LIMITER` entry. */
			ACTIVITYPUB_RATE_LIMITER?: RateLimit;
			/** The `send_email` binding support requests are delivered through. */
			EMAIL?: SendEmail;
			/** Set with `bunx wrangler secret put SUPPORT_INBOX`; unset keeps the form failing closed. */
			SUPPORT_INBOX?: string;
			/**
			 * Set with `bunx wrangler secret put GITHUB_TOKEN`; a token with no scopes reads the
			 * public sponsor roster, and unset keeps the stored roster unrefreshed.
			 */
			GITHUB_TOKEN?: string;
			CLIENT_ID: SecretsStoreSecret;
			CLIENT_SECRET: SecretsStoreSecret;
			COOKIE_SESSION_SECRET: SecretsStoreSecret;
			/** The archive.org account keys bookmarks are captured under, from the Secrets Store. */
			WAYBACK_ACCESS_KEY: SecretsStoreSecret;
			WAYBACK_SECRET_KEY: SecretsStoreSecret;
			/** The ActivityPub actor's PKCS#8 RSA private key, from the Secrets Store. */
			ACTIVITYPUB_PRIVATE_KEY: SecretsStoreSecret;
		}
	}

	/**
	 * Minimal Worker handler shape used by the bootstrap export. The execution
	 * context is part of the signature so the bootstrap can hand `waitUntil` to
	 * the cache, letting a miss return its response while the write finishes later.
	 */
	interface ExportedHandler<Env = unknown> {
		fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
	}
}

export {};
