/**
 * Auth middleware and session-identity helpers. The whole viewer profile (subject id,
 * name, email, avatar) is written into the session at login — there is no local users
 * table to verify against — so the session auth scheme simply reads those keys back.
 * Exposes helpers to read the current viewer, log in/out, and get/set the upstream
 * OIDC id token used for SSO logout. Exists as the app's identity access layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { auth as createAuthMiddleware, Auth, createSessionAuthScheme } from "remix/auth-middleware";
import { Session } from "remix/session";

/**
 * The authenticated viewer's profile, resolved entirely from session data.
 */
export interface Viewer {
	/** OIDC subject id from the upstream identity provider. */
	id: string;
	name: string;
	email: string;
	avatar: string;
}

const SESSION_KEYS = {
	id: "id",
	name: "name",
	email: "email",
	avatar: "avatar",
	idToken: "idToken",
} as const;

/**
 * Auth middleware that resolves the viewer from session data.
 */
export let auth = createAuthMiddleware({
	schemes: [
		createSessionAuthScheme<Viewer, Viewer>({
			read(session) {
				let id = session.get(SESSION_KEYS.id);
				if (typeof id !== "string") return null;
				return {
					id,
					name: String(session.get(SESSION_KEYS.name) ?? ""),
					email: String(session.get(SESSION_KEYS.email) ?? ""),
					avatar: String(session.get(SESSION_KEYS.avatar) ?? ""),
				};
			},
			verify(viewer) {
				return viewer;
			},
			invalidate(session) {
				session.unset(SESSION_KEYS.id);
				session.unset(SESSION_KEYS.name);
				session.unset(SESSION_KEYS.email);
				session.unset(SESSION_KEYS.avatar);
				session.unset(SESSION_KEYS.idToken);
			},
		}),
	],
});

export default auth;

/**
 * Returns the current authenticated viewer, or `null` when signed out.
 */
export function getViewer(): Viewer | null {
	let state = getContext().get(Auth) as { ok: boolean; identity: Viewer };
	if (!state.ok) return null;
	return state.identity;
}

/**
 * Indicates whether the current request has an authenticated viewer.
 */
export function isAuthenticated(): boolean {
	return getViewer() !== null;
}

/**
 * Regenerates the session id and writes the viewer's profile into it.
 */
export function login(viewer: Viewer): void {
	let session = readSession();
	session.regenerateId();
	session.set(SESSION_KEYS.id, viewer.id);
	session.set(SESSION_KEYS.name, viewer.name);
	session.set(SESSION_KEYS.email, viewer.email);
	session.set(SESSION_KEYS.avatar, viewer.avatar);
}

/**
 * Destroys the current session, signing the viewer out.
 */
export function logout(): void {
	readSession().destroy();
}

/**
 * Returns the upstream OIDC id token stored at login, used for SSO logout.
 */
export function getIdToken(): string | null {
	let idToken = readSession().get(SESSION_KEYS.idToken);
	return typeof idToken === "string" ? idToken : null;
}

/**
 * Stores the upstream OIDC id token in the session.
 */
export function setIdToken(idToken: string): void {
	readSession().set(SESSION_KEYS.idToken, idToken);
}

function readSession() {
	let session = getContext().get(Session);
	if (!session) {
		throw new Error("Session not found in context. Make sure to use the session middleware.");
	}
	return session;
}
