/**
 * Session-backed authentication layer: the {@link authMiddleware} that resolves the
 * signed-in user from the session, plus the request-scoped helpers controllers use
 * to read the user, cache their permission set, and sign in/out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { auth, Auth, createSessionAuthScheme } from "remix/middleware/auth";
import { createContextKey } from "remix/router";
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

/**
 * Returns the current request's session.
 * @returns The active session for this request.
 * @throws {Error} When the session middleware is not installed.
 */
export function getSession(): Session {
	let ctx = getContext();
	if (!ctx.has(Session)) throw new Error("Session middleware is not installed.");
	return ctx.get(Session) as Session;
}

/**
 * Returns the authenticated user resolved by {@link authMiddleware}.
 * @returns The signed-in user row, or `null` when the request is anonymous.
 */
export function getAuthUser(): SelectUser | null {
	let ctx = getContext();
	if (!ctx.has(Auth)) return null;
	let state = ctx.get(Auth);
	if (!state || !state.ok) return null;
	return state.identity as SelectUser;
}

/**
 * Resolves (and caches per request) the current user's permission set.
 * @returns The user's granted permissions, or an empty set when anonymous.
 */
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

/**
 * Reports whether the request has an authenticated user.
 * @returns True when a user is signed in.
 */
export function isAuthenticated(): boolean {
	return getAuthUser() !== null;
}

/**
 * Signs a user in by rotating the session id (fixation defense) and storing the user
 * id in the session.
 * @param user - The user to associate with the session.
 */
export function login(user: SelectUser): void {
	let session = getSession();
	session.regenerateId();
	session.set(USER_ID_KEY, user.id);
}

/** Destroys the session. */
export function logout(): void {
	getSession().destroy();
}

/**
 * Reads the stored OIDC id token (used as the logout `id_token_hint`).
 * @returns The id token, or `null` when none is stored.
 */
export function getIdToken(): string | null {
	let value = getSession().get(ID_TOKEN_KEY);
	return typeof value === "string" ? value : null;
}

/**
 * Stores the OIDC id token in the session for use at logout.
 * @param token - The id token returned by the provider.
 */
export function setIdToken(token: string): void {
	getSession().set(ID_TOKEN_KEY, token);
}
