import { getServiceContainer } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { auth, Auth, createSessionAuthScheme } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createContextKey } from "remix/fetch-router";
import { Session } from "remix/session";

import type { SelectUser } from "../../database/schema";
import type { Permission } from "../../shared/permissions";

import { Role } from "../../roles/models/role";
import { User } from "../../users/models/user";

/** Session keys owned by the auth layer. */
const USER_ID_KEY = "userId";
const ID_TOKEN_KEY = "idToken";

/** Cached per-request permission set. */
let permissionsKey = createContextKey<Set<Permission>>();

/**
 * Auth middleware: resolves the signed-in user from the session via
 * `createSessionAuthScheme`. The session id is read from the session (populated by
 * the session middleware) and verified by loading the `User`; the result is exposed
 * as `ctx.get(Auth)` / `ctx.auth`. Anonymous requests skip the DB read.
 */
export const authMiddleware = auth({
	schemes: [
		createSessionAuthScheme<SelectUser, string>({
			read(session) {
				let id = session.get(USER_ID_KEY);
				return typeof id === "string" ? id : null;
			},
			verify(userId) {
				return User.findById(getServiceContainer().get(Database), userId);
			},
			invalidate(session) {
				session.unset(USER_ID_KEY);
				session.unset(ID_TOKEN_KEY);
			},
		}),
	],
});

/** Returns the current request's session (requires the session middleware). */
export function getSession(): Session {
	let ctx = getContext();
	if (!ctx.has(Session)) throw new Error("Session middleware is not installed.");
	return ctx.get(Session) as Session;
}

/** The authenticated user resolved by {@link authMiddleware}, or null. */
export function getAuthUser(): SelectUser | null {
	let ctx = getContext();
	if (!ctx.has(Auth)) return null;
	let state = ctx.get(Auth);
	if (!state || !state.ok) return null;
	return state.identity as SelectUser;
}

/** Resolves (and caches) the current user's permission set (empty when anon). */
export async function getPermissions(): Promise<Set<Permission>> {
	let ctx = getContext();
	if (ctx.has(permissionsKey)) return ctx.get(permissionsKey) ?? new Set<Permission>();

	let user = getAuthUser();
	let permissions = user
		? await Role.permissionsFor(getServiceContainer().get(Database), user.role_id)
		: new Set<Permission>();
	ctx.set(permissionsKey, permissions);
	return permissions;
}

/** True when the request has an authenticated user. */
export function isAuthenticated(): boolean {
	return getAuthUser() !== null;
}

/** Signs a user in: rotates the session id and stores the user id. */
export function login(user: SelectUser): void {
	let session = getSession();
	session.regenerateId();
	session.set(USER_ID_KEY, user.id);
}

/** Destroys the session. */
export function logout(): void {
	getSession().destroy();
}

/** Reads the stored OIDC id token (for logout `id_token_hint`). */
export function getIdToken(): string | null {
	let value = getSession().get(ID_TOKEN_KEY);
	return typeof value === "string" ? value : null;
}

/** Stores the OIDC id token in the session. */
export function setIdToken(token: string): void {
	getSession().set(ID_TOKEN_KEY, token);
}
