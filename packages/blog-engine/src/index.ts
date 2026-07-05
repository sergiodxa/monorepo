import type { DatabaseAdapter } from "remix/data-table";
import type { SessionStorage } from "remix/session";

import { Logger } from "@pkg/logger/request";
import { ServiceContainer } from "@pkg/service-container";
import { createDatabase, Database } from "remix/data-table";

import type { OIDCMetadata } from "./auth/oidc";

import { runMigrations } from "./database/migrations";
import { createEngineRouter } from "./engine";
import { createSessionMiddleware } from "./shared/middleware/session";

export type { OIDCMetadata } from "./auth/oidc";
export type { ThemeSettings } from "./appearance/theme/theme";
export type { FieldDefinition, FieldKind } from "./post-types/models/post-type";
export type { Permission } from "./shared/permissions";

/** Configuration for {@link createBlogEngine}. */
export interface BlogEngineConfig {
	/** SQL access. Self-hosted: `@pkg/data-table-d1`. DO host: `@pkg/data-table-sqlstorage`. */
	database: DatabaseAdapter;

	/** OIDC relying-party configuration for the admin panel. */
	auth: {
		issuer: string;
		clientId: string;
		clientSecret: string;
		/** Static endpoints; when omitted the engine discovers them once per isolate. */
		metadata?: OIDCMetadata;
		/** OAuth scopes. Default `["openid", "profile", "email"]`. */
		scopes?: string[];
		/** Emails or subject ids always mapped to the admin role on login. */
		admins?: string[];
	};

	session: {
		/** Cookie signing secret. Never persisted by the engine. */
		secret: string;
		/** Default: engine-owned SQL session storage. Hosts may inject KV storage. */
		storage?: SessionStorage;
		/** Cookie name. Default `"blog:session"`. */
		cookieName?: string;
	};

	/**
	 * "auto" (default): run pending migrations lazily before the first request.
	 * "manual": the host calls `engine.migrate()` itself (DO host, in
	 * `blockConcurrencyWhile`).
	 */
	migrations?: "auto" | "manual";

	/** Controls `Secure` cookies. Default `false`. */
	isProd?: boolean;

	/** Host hook for background work (e.g. Cloudflare `ctx.waitUntil`). */
	waitUntil?: (promise: Promise<unknown>) => void;
}

/** A host-agnostic blog engine instance. */
export interface BlogEngine {
	/** Handles every request for one blog. Pure Fetch: Workers, DOs, Bun, Node. */
	fetch(request: Request): Promise<Response>;
	/** Applies pending engine-owned migrations. Idempotent (journaled). */
	migrate(): Promise<{ applied: string[] }>;
}

/**
 * Creates a blog engine bound to injected storage and secrets — the WordPress-core
 * boundary. The same engine runs inside a Cloudflare Durable Object (the SaaS
 * platform) or a plain Worker with D1 (self-hosted); the host differs only in the
 * {@link BlogEngineConfig.database} adapter it injects. Everything a blog owner
 * edits (title, theme, post types, posts, users, roles) lives in the blog's own DB.
 * @param config - Injected storage, OIDC config, and session secret.
 * @returns An engine exposing `fetch` and `migrate`.
 */
export function createBlogEngine(config: BlogEngineConfig): BlogEngine {
	let db = createDatabase(config.database);
	let container = new ServiceContainer();
	container.instance(Database, db);
	let sessionMiddleware = createSessionMiddleware({
		db,
		secret: config.session.secret,
		cookieName: config.session.cookieName,
		isProd: config.isProd,
		storage: config.session.storage,
	});
	let oidc = config.auth;

	let migrated: Promise<{ applied: string[] }> | null = null;
	function migrate() {
		return runMigrations(config.database);
	}

	return {
		migrate,
		async fetch(request) {
			if (config.migrations !== "manual") await (migrated ??= migrate());

			let logger = new Logger(request);
			try {
				let router = createEngineRouter({ logger, sessionMiddleware, oidc });
				let response = await container.scope(() => router.fetch(request));
				logger.response = response;
				return response;
			} finally {
				logger.flush();
			}
		},
	};
}
