/**
 * Session-backed authentication layer: the {@link authMiddleware} that resolves the
 * signed-in user from the session, plus the request-scoped helpers controllers use
 * to read the user, cache their permission set, and sign in/out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { AuthSession } from "@sdxc/auth/auth-session";
import { getServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { auth, Auth, createSessionAuthScheme } from "remix/middleware/auth";
import { createContextKey } from "remix/router";
import { Session } from "remix/session";

import type { SelectUser } from "../../database/schema.js";
import type { Permission } from "../../shared/permissions.js";

import { Role } from "../../roles/models/role.js";
import { User } from "../../users/models/user.js";

/** The session key holding the signed-in user's local row id. */
const USER_ID_KEY = "userId";

/** Cached per-request permission set. */
let permissionsKey = createContextKey<Set<Permission>>();

/**
 * Auth middleware: resolves the signed-in user from the session via
 * `createSessionAuthScheme`, verifying the session id by loading the `User` and
 * exposing it as `ctx.get(Auth)` / `ctx.auth`; anonymous requests skip the DB read.
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
				AuthSession.from(getContext())?.clear();
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
