/**
 * The built-in catalog of social identity providers: Google, Apple, Microsoft, GitHub,
 * GitLab, Facebook, LinkedIn, Discord and Slack. Each entry pre-fills a connection's
 * protocol shape, default scopes, subject claim and email-verification authority, so
 * choosing one at save time asks the tenant for nothing beyond a client id and secret.
 * A provider outside this list reaches the exact same connection shape by supplying
 * every field itself, which is why this module holds data only — no behavior of its
 * own beyond looking an entry up by id.
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
	 * treats its email the way an unauthoritative source is treated everywhere else.
	 */
	emailAuthority: boolean;
	/**
	 * A plain identifier for the provider's mark, since none of these nine has a brand
	 * icon in `@sdxc/icons` today (only a generic, unrelated "apple" glyph exists there) —
	 * inventing SVGs for a build-out that is not this pass's job would only have to be
	 * redone once real ones are added.
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
 * The nine providers the platform ships pre-filled forms for.
 *
 * Which of these are genuinely OIDC-discoverable rather than assumed to be, per entry:
 * - **Google**, **Microsoft**, **GitLab** and **LinkedIn** publish a standard
 *   `.well-known/openid-configuration` document at their `issuer`.
 * - **Apple** also publishes one, at `https://appleid.apple.com`, and Sign in with Apple's
 *   ID token is a standard OIDC token — but its authorization endpoint refuses a request
 *   asking for the `name` scope unless `response_mode=form_post` is set, which is a
 *   detail of the request Pass 2's authorization builder has to know rather than
 *   anything a catalog entry itself can carry.
 * - **GitHub**, **Facebook**, **Discord** and **Slack** publish no discovery document at
 *   all and are OAuth2 in practice: each names its authorization, token and userinfo
 *   endpoints directly. Slack's userinfo response happens to carry OIDC-shaped claims
 *   (`sub`, `email`, `email_verified`) from its own "Sign in with Slack" layer, but with
 *   no discovery document to resolve, it is configured the same OAuth2 way as the other
 *   three rather than as an `issuer`.
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
		// Apple's own scope is `name`, not the `profile` every other OIDC provider here
		// uses, and it is the only one of the nine that hands the ID token back over a
		// POSTed form body rather than a query string redirect.
		scopes: ["openid", "email", "name"],
		subjectClaim: "sub",
		// Apple's ID token carries `email_verified`, unusually as the string "true"/"false"
		// rather than a JSON boolean — a detail Pass 2's claim mapping has to coerce, not
		// something this catalog entry needs to encode.
		emailAuthority: true,
		icon: "apple",
	},
	{
		id: "microsoft",
		displayName: "Microsoft",
		kind: "oidc",
		// The multi-tenant "common" endpoint, which accepts a personal or a work/school
		// account. Its discovery document's own `issuer` field is templated as
		// `https://login.microsoftonline.com/{tenantid}/v2.0` with the placeholder
		// left literal rather than filled in, since discovery for "common" describes
		// every tenant at once — `Issuer.for` has to accept that mismatch rather than
		// refuse it the way it would for a single-tenant issuer.
		issuer: "https://login.microsoftonline.com/common/v2.0",
		scopes: ["openid", "email", "profile"],
		subjectClaim: "sub",
		// Microsoft's `email` claim is best-effort — it is absent for plenty of work
		// and school accounts and carries no `email_verified` claim to check, so it is
		// not treated as an authoritative assertion here.
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
		// GitHub's `/user` response has no `sub`; its own numeric `id` is the stable
		// per-application identifier the same way `sub` is for an OIDC provider.
		subjectClaim: "id",
		// The `/user` response's `email` field is nullable and carries no verification
		// state; the verified list lives behind a separate `/user/emails` call this
		// catalog entry has no field for, so this connection has nothing authoritative
		// to assert about email here.
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
		// Unlike every other userinfo endpoint in this catalog, Facebook's Graph API
		// answers only the fields a request names explicitly.
		userinfoEndpoint: "https://graph.facebook.com/me?fields=id,name,email",
		scopes: ["public_profile", "email"],
		subjectClaim: "id",
		// Facebook omits the `email` field entirely rather than hand back an unverified
		// one, so its presence is itself the verification — there is no separate flag.
		emailAuthority: true,
		icon: "facebook",
	},
	{
		id: "linkedin",
		displayName: "LinkedIn",
		kind: "oidc",
		// LinkedIn's current "Sign In with LinkedIn using OpenID Connect", not the
		// retired `r_liteprofile`/`r_emailaddress` API this issuer predates.
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
		// Discord's own field is `verified`, not the `email_verified` every OIDC entry
		// here carries — the same authority, under a provider-specific name Pass 2's
		// mapping has to read from rather than assume.
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
