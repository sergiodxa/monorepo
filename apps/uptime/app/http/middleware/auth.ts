/**
 * Auth middleware and the app-wide viewer accessor. The signed-in request's tokens
 * are the source of truth: the OIDC session scheme reads them, renews an access
 * token that has lapsed, and projects the ID token's claims into the {@link Viewer}
 * every controller and view reads through `getViewer()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthSession } from "@pkg/auth/auth-session";
import type { Middleware } from "remix/router";

import { getContext } from "remix/middleware/async-context";
import { auth as createAuthMiddleware, Auth } from "remix/middleware/auth";

import { relyingParty } from "~/app/auth/relying-party";

/**
 * The authenticated viewer, as the app names the claims it shows a person back to
 * themselves with. Every field but `id` is display data, so an absent claim reads
 * as empty text rather than putting a null check in every view.
 */
export interface Viewer {
	/** OIDC subject id, which every record this app owns is keyed on. */
	id: string;
	name: string;
	email: string;
	avatar: string;
}

/**
 * Projects the signed-in session's ID token into the viewer shape.
 *
 * @param auth - The token set the OIDC session scheme resolved.
 */
function toViewer(auth: AuthSession): Viewer {
	let idToken = auth.idToken;

	return {
		id: idToken.subject,
		name: idToken.name ?? "",
		email: idToken.email ?? "",
		avatar: idToken.picture ?? "",
	};
}

/**
 * Resolves the viewer from the request's stored token set.
 *
 * Built per request because the scheme's relying party is, so the renewal it may
 * run presents the credentials for the origin the request arrived on.
 */
export let auth: Middleware = (ctx, next) => {
	return createAuthMiddleware({
		schemes: [relyingParty(ctx.url).scheme({ verify: toViewer })],
	})(ctx, next);
};

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
