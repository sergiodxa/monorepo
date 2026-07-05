import type { OIDCAuthProfile, OIDCAuthProviderMetadata } from "remix/auth";

import { createOIDCAuthProvider } from "remix/auth";

import type { AuthProfile } from "../users/models/user";

/** OIDC provider discovery metadata (re-exported from `remix/auth`). */
export type OIDCMetadata = OIDCAuthProviderMetadata;

/** Relying-party configuration for the admin panel's OIDC client. */
export interface OIDCConfig {
	issuer: string;
	clientId: string;
	clientSecret: string;
	/** Inline discovery metadata; when omitted `remix/auth` discovers it from the issuer. */
	metadata?: OIDCMetadata;
	scopes?: string[];
	/** Emails or subject ids always mapped to the admin role on login. */
	admins?: string[];
}

/**
 * Builds the `remix/auth` OIDC provider for a request. The redirect URI is derived
 * from the request so one build serves any hostname; `startExternalAuth` and
 * `finishExternalAuth` drive the PKCE flow against it.
 * @param config - The relying-party configuration.
 * @param redirectUri - The absolute `/auth/callback` URL for this request's host.
 * @returns A configured OIDC auth provider.
 */
export function createProvider(config: OIDCConfig, redirectUri: string) {
	return createOIDCAuthProvider({
		name: "oidc",
		issuer: config.issuer,
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		redirectUri,
		scopes: config.scopes,
		metadata: config.metadata,
	});
}

/** Per-isolate cache of discovered `end_session_endpoint`s, keyed by issuer. */
const endSessionCache = new Map<string, string | null>();

/**
 * Resolves the provider's `end_session_endpoint` (for `id_token_hint` logout) from
 * inline metadata or OIDC discovery. Returns `null` when the provider offers none.
 * @param config - The relying-party configuration.
 */
export async function resolveEndSessionEndpoint(config: OIDCConfig): Promise<string | null> {
	let inline = (config.metadata as Record<string, unknown> | undefined)?.["end_session_endpoint"];
	if (typeof inline === "string") return inline;

	if (endSessionCache.has(config.issuer)) return endSessionCache.get(config.issuer) ?? null;
	let result: string | null = null;
	try {
		let base = config.issuer.endsWith("/") ? config.issuer : `${config.issuer}/`;
		let response = await fetch(new URL(".well-known/openid-configuration", base), {
			headers: { accept: "application/json" },
		});
		if (response.ok) {
			let meta = (await response.json()) as { end_session_endpoint?: string };
			result = meta.end_session_endpoint ?? null;
		}
	} catch {
		result = null;
	}
	endSessionCache.set(config.issuer, result);
	return result;
}

/** Maps an OIDC profile to the engine's {@link AuthProfile}. */
export function toAuthProfile(profile: OIDCAuthProfile): AuthProfile {
	let email = profile.email ?? "";
	return {
		subjectId: profile.sub,
		email,
		username: profile.preferred_username ?? email.split("@")[0] ?? profile.sub,
		displayName: profile.name ?? "",
		avatar: profile.picture ?? "",
	};
}
