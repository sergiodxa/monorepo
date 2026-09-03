/**
 * The engine's OIDC relying-party seam for the admin panel: the issuer a blog's
 * logins are verified against, the per-request client that drives the flow, and the
 * mapping from the provider's display claims to the engine's own user fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Issuer } from "@sdxc/auth/issuer";
import { RelyingParty } from "@sdxc/auth/relying-party";

import type { AuthProfile } from "../users/models/user";

import routes from "../routes";

/**
 * An OIDC discovery document, in the shape a provider publishes it, so a document
 * copied from an issuer is accepted as configured metadata unchanged.
 */
export type OIDCMetadata = Issuer.Metadata;

/**
 * The engine's admin-panel relying-party configuration: the provider a blog's
 * administrators sign in through, plus the two settings that decide which of them
 * arrives holding the admin role.
 */
export interface EngineAuthConfig {
	/** The issuer identifier, which is also what its tokens carry as `iss`. */
	issuer: string;
	/** The client this blog is registered as at the issuer. */
	clientId: string;
	/** The client secret, presented at the token endpoint. */
	clientSecret: string;
	/** Static endpoints; when omitted the engine discovers them once per instance. */
	metadata?: OIDCMetadata;
	/** OAuth scopes. Default `["openid", "profile", "email"]`. */
	scopes?: string[];
	/** Emails or subject ids always mapped to the admin role on login. */
	admins?: string[];
	/**
	 * Grant the admin role to the first user to sign in while no admin exists yet.
	 * Defaults to `true` for self-hosted convenience; multi-tenant hosts set `false` so
	 * a stray SSO user cannot claim admin before the tenant's real owner does.
	 */
	bootstrapFirstAdmin?: boolean;
}

/**
 * Builds the issuer for one blog. The engine holds it for the life of the instance,
 * so a blog reads its provider's discovery document and key set once and every later
 * login is answered from that instance's memo.
 *
 * @param config - The blog's relying-party configuration.
 * @returns The issuer every login for this blog is measured against.
 * @example let issuer = createIssuer(config.auth);
 */
export function createIssuer(config: EngineAuthConfig): Issuer {
	return new Issuer(config.issuer, { metadata: config.metadata });
}

/**
 * Builds the client for one request, so a blog reachable at both its subdomain and a
 * custom domain finishes a login on the hostname that started it. Display claims absent
 * from the ID token are read at userinfo, so the `email` the admin allow-list matches arrives.
 *
 * @param issuer - The blog's issuer.
 * @param config - The blog's relying-party configuration.
 * @param url - The current request's URL, which the callback URL is built against.
 * @returns The client the login, callback, and logout routes drive.
 * @example let grant = await createRelyingParty(issuer, config, ctx.url).callback(ctx);
 */
export function createRelyingParty(
	issuer: Issuer,
	config: EngineAuthConfig,
	url: URL,
): RelyingParty {
	return new RelyingParty(issuer, {
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		redirectUri: new URL(routes.auth.callback.href(), url),
		scopes: config.scopes,
		userInfo: "when-missing",
		fallbackReturnTo: routes.cms.dashboard.href(),
	});
}

/**
 * Maps a completed login to the engine's {@link AuthProfile}. `username` falls back
 * to the email local part and then to the subject, and the display fields normalize
 * to empty strings, which is what the user record's columns hold.
 *
 * @param profile - The display claims the login resolved.
 * @param subject - The identity anchor the user record is keyed on.
 * @returns The engine's {@link AuthProfile}.
 * @example let user = await User.findOrCreateFromAuthProfile(db, toAuthProfile(grant.profile, grant.subject));
 */
export function toAuthProfile(profile: RelyingParty.Profile, subject: string): AuthProfile {
	let email = profile.email ?? "";
	return {
		subjectId: subject,
		email,
		username: profile.username ?? email.split("@")[0] ?? subject,
		displayName: profile.name ?? "",
		avatar: profile.picture ?? "",
	};
}
