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

import { getContext } from "remix/middleware/async-context";
import { auth as createAuthMiddleware, Auth, createSessionAuthScheme } from "remix/middleware/auth";
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

enum SESSION_KEYS {
	ID = "id",
	NAME = "name",
	EMAIL = "email",
	AVATAR = "avatar",
	ID_TOKEN = "idToken",
}

/**
 * Reads a profile field out of the session as text. Session values are untyped, so
 * anything that is not a string — an absent key, or one left by an older cookie shape —
 * reads as empty rather than as that value's default stringification.
 */
function toText(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/**
 * Auth middleware that resolves the viewer from session data.
 */
export let auth = createAuthMiddleware({
	schemes: [
		createSessionAuthScheme<Viewer, Viewer>({
			read(session) {
				let id = session.get(SESSION_KEYS.ID);
				if (typeof id !== "string") return null;
				return {
					id,
					name: toText(session.get(SESSION_KEYS.NAME)),
					email: toText(session.get(SESSION_KEYS.EMAIL)),
					avatar: toText(session.get(SESSION_KEYS.AVATAR)),
				};
			},
			verify(viewer) {
				return viewer;
			},
			invalidate(session) {
				session.unset(SESSION_KEYS.ID);
				session.unset(SESSION_KEYS.NAME);
				session.unset(SESSION_KEYS.EMAIL);
				session.unset(SESSION_KEYS.AVATAR);
				session.unset(SESSION_KEYS.ID_TOKEN);
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
	session.set(SESSION_KEYS.ID, viewer.id);
	session.set(SESSION_KEYS.NAME, viewer.name);
	session.set(SESSION_KEYS.EMAIL, viewer.email);
	session.set(SESSION_KEYS.AVATAR, viewer.avatar);
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
	let idToken = readSession().get(SESSION_KEYS.ID_TOKEN);
	return typeof idToken === "string" ? idToken : null;
}

/**
 * Stores the upstream OIDC id token in the session.
 */
export function setIdToken(idToken: string): void {
	readSession().set(SESSION_KEYS.ID_TOKEN, idToken);
}

function readSession() {
	let session = getContext().get(Session);
	if (!session) {
		throw new Error("Session not found in context. Make sure to use the session middleware.");
	}
	return session;
}
