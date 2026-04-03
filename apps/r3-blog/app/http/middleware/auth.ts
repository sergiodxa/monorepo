import { getContext } from "remix/async-context-middleware";
import { auth as createAuthMiddleware, Auth, createSessionAuthScheme } from "remix/auth-middleware";
import { createContextKey } from "remix/fetch-router";
import { Database } from "remix/data-table";
import { Session } from "remix/session";

import type * as schema from "~/database/schema";

import { User } from "~/app/repositories/user";

export let AUTH_SESSION_USER_ID_KEY = "userId";
export let AUTH_SESSION_ID_TOKEN_KEY = "idToken";

let authUserKey = createContextKey<schema.SelectUser | null>();

export let auth = createAuthMiddleware({
	schemes: [
		createSessionAuthScheme({
			read(session) {
				let userId = session.get(AUTH_SESSION_USER_ID_KEY);
				return typeof userId === "string" ? userId : null;
			},
			verify(userId) {
				return User.findById(getContext().get(Database), userId);
			},
			invalidate(session) {
				session.unset(AUTH_SESSION_USER_ID_KEY);
				session.unset(AUTH_SESSION_ID_TOKEN_KEY);
			},
		}),
	],
});

export default auth;

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

export function isAuthenticated() {
	return Boolean(getAuthUser());
}

export function isAdmin() {
	let user = getAuthUser();
	return user?.role === "admin";
}

export function login(user: schema.SelectUser) {
	let session = readSession();
	session.regenerateId();
	session.set(AUTH_SESSION_USER_ID_KEY, user.id);
	getContext().set(authUserKey, user);
}

export function logout() {
	let session = readSession();
	session.destroy();
	getContext().set(authUserKey, null);
}

export function getIdToken() {
	let session = readSession();
	let idToken = session.get(AUTH_SESSION_ID_TOKEN_KEY);
	if (typeof idToken !== "string") return null;
	return idToken;
}

export function setIdToken(token: string) {
	let session = readSession();
	session.set(AUTH_SESSION_ID_TOKEN_KEY, token);
}

function readSession() {
	let ctx = getContext();
	if (!ctx.has(Session)) {
		throw new Error("Session not found in context. Make sure to use the session middleware.");
	}

	return ctx.get(Session);
}

function resolveCurrentUser() {
	let auth = getContext().get(Auth) as { ok: boolean; identity: schema.SelectUser };
	if (!auth.ok) return null;
	return auth.identity;
}
