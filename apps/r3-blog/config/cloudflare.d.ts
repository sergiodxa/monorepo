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
			CLIENT_ID: SecretsStoreSecret;
			CLIENT_SECRET: SecretsStoreSecret;
			COOKIE_SESSION_SECRET: SecretsStoreSecret;
		}
	}

	/** Minimal Worker handler shape used by the bootstrap export. */
	interface ExportedHandler<Env = unknown> {
		fetch(request: Request, env: Env): Response | Promise<Response>;
	}
}

export {};
