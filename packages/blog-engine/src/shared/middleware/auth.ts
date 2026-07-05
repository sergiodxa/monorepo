import { getContext } from "remix/async-context-middleware";
import { createContextKey } from "remix/fetch-router";
import { Session } from "remix/session";

import type { SelectUser } from "../../database/schema";
import type { Permission } from "../../domain/permissions";

import { Role } from "../../domain/role";
import { User } from "../../domain/user";

/** Session keys owned by the auth layer. */
const USER_ID_KEY = "userId";
const ID_TOKEN_KEY = "idToken";

/** Cached per-request auth user (undefined = not yet resolved). */
let authUserKey = createContextKey<SelectUser | null>();
/** Cached per-request permission set. */
let permissionsKey = createContextKey<Set<Permission>>();

/** Returns the current request's session (requires the session middleware). */
export function getSession(): Session {
	let ctx = getContext();
	if (!ctx.has(Session)) throw new Error("Session middleware is not installed.");
	return ctx.get(Session) as Session;
}

/** Resolves (and caches) the authenticated user for this request, or null. */
export async function getAuthUser(): Promise<SelectUser | null> {
	let ctx = getContext();
	if (ctx.has(authUserKey)) return ctx.get(authUserKey) ?? null;

	let session = getSession();
	let userId = session.get(USER_ID_KEY);
	let user = typeof userId === "string" ? await User.findById(ctx.db, userId) : null;
	ctx.set(authUserKey, user);
	return user;
}

/** Resolves (and caches) the current user's permission set (empty when anon). */
export async function getPermissions(): Promise<Set<Permission>> {
	let ctx = getContext();
	if (ctx.has(permissionsKey)) return ctx.get(permissionsKey) ?? new Set<Permission>();

	let user = await getAuthUser();
	let permissions = user ? await Role.permissionsFor(ctx.db, user.role_id) : new Set<Permission>();
	ctx.set(permissionsKey, permissions);
	return permissions;
}

/** True when the request has an authenticated user. */
export async function isAuthenticated(): Promise<boolean> {
	return (await getAuthUser()) !== null;
}

/** Signs a user in: rotates the session id and stores the user id. */
export function login(user: SelectUser): void {
	let session = getSession();
	session.regenerateId();
	session.set(USER_ID_KEY, user.id);
	getContext().set(authUserKey, user);
}

/** Destroys the session and clears cached auth state. */
export function logout(): void {
	let session = getSession();
	session.destroy();
	let ctx = getContext();
	ctx.set(authUserKey, null);
	ctx.set(permissionsKey, new Set<Permission>());
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
