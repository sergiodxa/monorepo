/**
 * Session-based authentication: the session carries the user id, which is
 * verified against the user repository on every request so handlers always see
 * a live user record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { auth as createAuthMiddleware, Auth, createSessionAuthScheme } from "remix/middleware/auth";
import { createContextKey } from "remix/router";
import { Session } from "remix/session";

import type * as schema from "~/database/schema";

import { User } from "~/app/repositories/user";

/**
 * Session key used to store the authenticated user id.
 */
export let AUTH_SESSION_USER_ID_KEY = "userId";
/**
 * Session key used to store the upstream identity token.
 */
export let AUTH_SESSION_ID_TOKEN_KEY = "idToken";

let authUserKey = createContextKey<schema.SelectUser | null>();

/**
 * Auth middleware that reads, verifies, and invalidates the session identity.
 */
export let auth = createAuthMiddleware({
	schemes: [
		createSessionAuthScheme({
			read(session) {
				let userId = session.get(AUTH_SESSION_USER_ID_KEY);
				return typeof userId === "string" ? userId : null;
			},
			verify(userId) {
				return User.findById(readDatabase(), userId);
			},
			invalidate(session) {
				session.unset(AUTH_SESSION_USER_ID_KEY);
				session.unset(AUTH_SESSION_ID_TOKEN_KEY);
			},
		}),
	],
});

export default auth;

/**
 * Resolves the authenticated user once per request and caches it in context so
 * repeated calls reuse the same record. Requires the auth middleware to have
 * run for the request.
 */
export function getAuthUser() {
	let ctx = getContext();

	if (ctx.has(authUserKey)) {
		let user = ctx.get(authUserKey);
		return user ?? null;
	}

	if (!ctx.has(Auth)) {
		throw new Error("Auth not found in context. Make sure to use the auth middleware.");
	}

	let user = resolveCurrentUser();
	ctx.set(authUserKey, user);
	return user;
}

/**
 * Indicates whether the current request has an authenticated user.
 */
export function isAuthenticated() {
	return Boolean(getAuthUser());
}

/**
 * Indicates whether the current authenticated user has admin role.
 */
export function isAdmin() {
	let user = getAuthUser();
	return user?.role === "admin";
}

/**
 * Signs the user in under a freshly generated session id, so the signed-in
 * session is distinct from the one held while anonymous.
 */
export function login(user: schema.SelectUser) {
	let session = readSession();
	session.regenerateId();
	session.set(AUTH_SESSION_USER_ID_KEY, user.id);
	getContext().set(authUserKey, user);
}

/**
 * Destroys the current session and clears cached auth user context.
 */
export function logout() {
	let session = readSession();
	session.destroy();
	getContext().set(authUserKey, null);
}

/**
 * Reads the identity token held in the session, or `null` when the session
 * holds none.
 */
export function getIdToken() {
	let session = readSession();
	let idToken = session.get(AUTH_SESSION_ID_TOKEN_KEY);
	if (typeof idToken !== "string") return null;
	return idToken;
}

/**
 * Stores an identity token in the current session.
 */
export function setIdToken(token: string) {
	let session = readSession();
	session.set(AUTH_SESSION_ID_TOKEN_KEY, token);
}

function readSession() {
	let ctx = getContext();
	if (!ctx.has(Session)) {
		throw new Error("Session not found in context. Make sure to use the session middleware.");
	}

	let session = ctx.get(Session);
	if (!session)
		throw new Error("Session not found in context. Make sure to use the session middleware.");
	return session;
}

function readDatabase() {
	return getServiceContainer().get(Database);
}

function resolveCurrentUser() {
	let auth = getContext().get(Auth) as { ok: boolean; identity: schema.SelectUser };
	if (!auth.ok) return null;
	return auth.identity;
}
