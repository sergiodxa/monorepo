/**
 * Factory ({@link createSessionMiddleware}) for the cookie-backed session middleware
 * used by the admin panel, plus the {@link SessionValues} shape persisted in a
 * session. Defaults to {@link SqlSessionStorage} but accepts a storage override.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";
import type { Middleware } from "remix/router";
import type { SessionStorage } from "remix/session";

import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";

import { SqlSessionStorage } from "../../database/session-storage";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

/** Values persisted in a blog admin session. */
export interface SessionValues extends Record<string, unknown> {
	userId?: string;
	idToken?: string;
	/** OIDC PKCE transaction, present only between login start and callback. */
	__auth?: {
		provider: string;
		state: string;
		codeVerifier: string;
		returnTo?: string;
	};
}

/** Options for {@link createSessionMiddleware}. */
export interface SessionMiddlewareOptions {
	db: Database;
	secret: string;
	cookieName?: string;
	isProd?: boolean;
	/** Optional storage override; defaults to {@link SqlSessionStorage} over the DB. */
	storage?: SessionStorage;
}

/**
 * Builds the cookie-backed session middleware for the engine's admin panel, wiring
 * the signed cookie to a session storage (SQL-backed by default).
 * @param options - Cookie/secret settings and an optional storage override.
 * @returns The configured session middleware.
 */
export function createSessionMiddleware(options: SessionMiddlewareOptions): Middleware {
	let cookie = createCookie(options.cookieName ?? "blog:session", {
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure: options.isProd ?? false,
		secrets: [options.secret],
	});

	let storage =
		options.storage ?? new SqlSessionStorage(options.db, { ttlSeconds: SESSION_TTL_SECONDS });

	return session(cookie, storage) as Middleware;
}
