/**
 * The built-in catalog of social identity providers: Google, Apple, Microsoft, GitHub,
 * GitLab, Facebook, LinkedIn, Discord and Slack.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Whether a catalog entry publishes an OIDC discovery document (`issuer` resolves
 * through it) or names its authorization, token and userinfo endpoints directly
 * because it publishes none.
 */
export type ConnectionCatalogEntryKind = "oidc" | "oauth2";

/** The fields every catalog entry carries regardless of which shape it takes. */
interface ConnectionCatalogEntryCommon {
	/** The id `saveConnection`'s `catalogEntry` input names, and `connections.catalog_entry` stores. */
	id: string;
	displayName: string;
	/** Default scopes a connection asks for unless the tenant overrides them. */
	scopes: string[];
	/** The claim (OIDC) or userinfo field (OAuth2) holding the provider's own subject identifier. */
	subjectClaim: string;
	/**
	 * Whether the provider's own verified-email assertion may be trusted outright. `false`
	 * means the provider either omits the claim, uses an unverified one, or ties it to
	 * something looser than proof of mailbox control — a mapping onto this connection
	 */
	emailAuthority: boolean;
	/**
	 * A plain identifier for the provider's mark, since none of these nine has a brand
	 * icon in `@sdxc/icons` today (only a generic, unrelated "apple" glyph exists there) —
	 * inventing SVGs for a build-out that is not this pass's job would only have to be
	 */
	icon: string;
}

/** A catalog entry naming an OIDC discovery URL. */
export interface OidcConnectionCatalogEntry extends ConnectionCatalogEntryCommon {
	kind: "oidc";
	issuer: string;
}

/** A catalog entry naming its three endpoints directly, for a provider with no discovery document. */
export interface OAuth2ConnectionCatalogEntry extends ConnectionCatalogEntryCommon {
	kind: "oauth2";
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
}

export type ConnectionCatalogEntry = OidcConnectionCatalogEntry | OAuth2ConnectionCatalogEntry;

/**
 * The nine providers the platform ships pre-filled forms for. Which of these are genuinely
 * OIDC-discoverable rather than assumed to be, per entry: - **Google**, **Microsoft**,
 * **GitLab** and **LinkedIn** publish a standard `.well-known/openid-configuration`
 */
export const CONNECTION_CATALOG: readonly ConnectionCatalogEntry[] = [
	{
		id: "google",
		displayName: "Google",
		kind: "oidc",
		issuer: "https://accounts.google.com",
		scopes: ["openid", "email", "profile"],
		subjectClaim: "sub",
		emailAuthority: true,
		icon: "google",
	},
	{
		id: "apple",
		displayName: "Apple",
		kind: "oidc",
		issuer: "https://appleid.apple.com",

		scopes: ["openid", "email", "name"],
		subjectClaim: "sub",

		emailAuthority: true,
		icon: "apple",
	},
	{
		id: "microsoft",
		displayName: "Microsoft",
		kind: "oidc",

		issuer: "https://login.microsoftonline.com/common/v2.0",
		scopes: ["openid", "email", "profile"],
		subjectClaim: "sub",

		emailAuthority: false,
		icon: "microsoft",
	},
	{
		id: "github",
		displayName: "GitHub",
		kind: "oauth2",
		authorizationEndpoint: "https://github.com/login/oauth/authorize",
		tokenEndpoint: "https://github.com/login/oauth/access_token",
		userinfoEndpoint: "https://api.github.com/user",
		scopes: ["read:user", "user:email"],

		subjectClaim: "id",

		emailAuthority: false,
		icon: "github",
	},
	{
		id: "gitlab",
		displayName: "GitLab",
		kind: "oidc",
		issuer: "https://gitlab.com",
		scopes: ["openid", "email", "profile"],
		subjectClaim: "sub",
		emailAuthority: true,
		icon: "gitlab",
	},
	{
		id: "facebook",
		displayName: "Facebook",
		kind: "oauth2",
		authorizationEndpoint: "https://www.facebook.com/dialog/oauth",
		tokenEndpoint: "https://graph.facebook.com/oauth/access_token",

		userinfoEndpoint: "https://graph.facebook.com/me?fields=id,name,email",
		scopes: ["public_profile", "email"],
		subjectClaim: "id",

		emailAuthority: true,
		icon: "facebook",
	},
	{
		id: "linkedin",
		displayName: "LinkedIn",
		kind: "oidc",

		issuer: "https://www.linkedin.com/oauth",
		scopes: ["openid", "email", "profile"],
		subjectClaim: "sub",
		emailAuthority: true,
		icon: "linkedin",
	},
	{
		id: "discord",
		displayName: "Discord",
		kind: "oauth2",
		authorizationEndpoint: "https://discord.com/api/oauth2/authorize",
		tokenEndpoint: "https://discord.com/api/oauth2/token",
		userinfoEndpoint: "https://discord.com/api/users/@me",
		scopes: ["identify", "email"],
		subjectClaim: "id",

		emailAuthority: true,
		icon: "discord",
	},
	{
		id: "slack",
		displayName: "Slack",
		kind: "oauth2",
		authorizationEndpoint: "https://slack.com/openid/connect/authorize",
		tokenEndpoint: "https://slack.com/api/openid.connect.token",
		userinfoEndpoint: "https://slack.com/api/openid.connect.userInfo",
		scopes: ["openid", "email", "profile"],
		subjectClaim: "sub",
		emailAuthority: true,
		icon: "slack",
	},
];

const CONNECTION_CATALOG_BY_ID = new Map(CONNECTION_CATALOG.map((entry) => [entry.id, entry]));

/** Looks up a catalog entry by its id, answering `undefined` for anything outside the nine. */
export function findConnectionCatalogEntry(id: string): ConnectionCatalogEntry | undefined {
	return CONNECTION_CATALOG_BY_ID.get(id);
}
