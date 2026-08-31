/**
 * Signs a request in from a test, by writing the token set the auth middleware reads.
 * Exists so a test covering something downstream of authentication — a route guard,
 * language resolution, an action — states who is signed in and runs the real
 * middleware chain, with no identity provider to reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSession } from "@pkg/auth/auth-session";
import { getContext } from "remix/middleware/async-context";

import type { Viewer } from "~/app/http/middleware/auth";

/** Seconds in an hour, the lifetime the fixture hands its access token. */
const ONE_HOUR = 3600;

/** Encodes bytes as unpadded base64url, the encoding a compact JWS segment uses. */
function base64url(value: string): string {
	let bytes = new TextEncoder().encode(value);
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A compact JWS carrying the given claims. The signature stays a placeholder because
 * a stored token set is read for its claims rather than re-verified — verification
 * happened at the callback that wrote it.
 */
function token(claims: Record<string, unknown>): string {
	let header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT" }));
	return `${header}.${base64url(JSON.stringify(claims))}.signature`;
}

/**
 * Signs the current request in as `viewer`, so the auth middleware after this
 * resolves it and `getViewer()` answers with the same fields.
 *
 * @param viewer - Who the request is signed in as.
 * @param scopes - Scopes the access token carries, for a route reading a delegation.
 * @example signIn({ id: "user_1", name: "Ada", email: "ada@example.com", avatar: "" });
 */
export function signIn(viewer: Viewer, scopes: string[] = ["openid", "profile", "email"]): void {
	let expiresAt = Math.floor(Date.now() / 1000) + ONE_HOUR;

	AuthSession.write(getContext(), {
		idToken: token({
			sub: viewer.id,
			name: viewer.name,
			email: viewer.email,
			picture: viewer.avatar,
			preferred_username: viewer.id,
			exp: expiresAt,
		}),
		accessToken: token({ sub: viewer.id, scope: scopes.join(" "), exp: expiresAt }),
		refreshToken: null,
		expiresAt,
	});
}
