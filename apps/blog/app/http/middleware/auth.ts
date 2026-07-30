/**
 * HTTP auth middleware and session helpers. It configures a session-based auth
 * scheme that reads the user id from the session and verifies it against the user
 * repository, and exports helpers to read the current user, check
 * authenticated/admin status, log in/out, and get/set the stored ID token.
 * Exists as the app's central authentication and identity access layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getServiceContainer } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { auth as createAuthMiddleware, Auth, createSessionAuthScheme } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createContextKey } from "remix/fetch-router";
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

/**
 * Default auth middleware export for route middleware registration.
 */
export default auth;

/**
 * Returns the current authenticated user from request context.
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
 * Regenerates the session and signs in the provided user.
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
 * Returns the stored identity token from the current session.
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
