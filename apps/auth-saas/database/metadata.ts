/**
 * Discovery and `/userinfo`: the read-only surfaces that describe a tenant to the clients
 * that use it. `publishMetadata` renders both metadata documents and the JWKS document in
 * one call, built from the same tenant facts so the two documents can never disagree about
 * what they describe. `resolveUserInfo` assembles the claims a subject's granted scopes
 * carry, omitting a claim rather than nulling it whenever the tenant's schema has nowhere
 * for its value to come from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { and, eq } from "remix/data-table";

import type { PublishedKeySet } from "./signing-keys";
import type { SubjectRow } from "./subjects";

import { scopes } from "./consent";
import { publishKeySet } from "./signing-keys";
import { subjectIdentifiers, subjects } from "./subjects";

/** How long `Cache-Control` lets a cached copy of these documents stand, in seconds. */
const MAX_AGE_SECONDS = 300;

/** The claims every issued token carries regardless of scope, advertised alongside them. */
const REGISTERED_CLAIMS = ["sub", "iss", "aud", "exp", "iat"];

/** Standard `/userinfo` claim names read straight off a subject's profile columns. */
const PROFILE_CLAIM_COLUMNS: Record<string, keyof SubjectRow> = {
	name: "name",
	given_name: "given_name",
	family_name: "family_name",
	nickname: "nickname",
	preferred_username: "preferred_username",
	picture: "picture",
	locale: "locale",
	zoneinfo: "zoneinfo",
};

export interface PublishMetadataInput {
	now: number;
	issuer: string;
}

export interface PublishMetadataResult {
	openidConfiguration: Record<string, unknown>;
	oauthMetadata: Record<string, unknown>;
	jwks: PublishedKeySet;
	version: string;
	maxAge: number;
}

let PublishMetadataSchema = s.object({ now: s.number(), issuer: s.string() });

/**
 * Renders the OpenID configuration, the OAuth authorization server metadata, and the JWKS
 * document in one call, so a cold cache costs one round trip rather than three. Both
 * metadata documents are built from the same endpoint URLs and the same tenant scope
 * catalog, so nothing about them can drift apart the way two separately written literals
 * could.
 *
 * @param db - The tenant's database.
 * @param input - The clock the key set's publish window is measured against, and the
 * issuer the Worker resolved for this tenant's hostname.
 * @returns Both metadata documents, the published key set, a version a caller can compare
 * against what it has cached, and how long the documents may be cached for.
 */
export async function publishMetadata(
	db: Database,
	input: PublishMetadataInput,
): Promise<PublishMetadataResult> {
	let parsed = s.parse(PublishMetadataSchema, input);

	let scopeRows = await db.findMany(scopes);
	let scopesSupported = scopeRows.map((row) => row.name);

	let claimsSupported = new Set(REGISTERED_CLAIMS);
	for (let row of scopeRows) for (let claim of row.claims as string[]) claimsSupported.add(claim);

	let endpoints = {
		issuer: parsed.issuer,
		authorizationEndpoint: `${parsed.issuer}/authorize`,
		tokenEndpoint: `${parsed.issuer}/oauth/token`,
		userinfoEndpoint: `${parsed.issuer}/userinfo`,
		jwksUri: `${parsed.issuer}/.well-known/jwks.json`,
	};

	let responseTypesSupported = ["code"];
	let grantTypesSupported = ["authorization_code", "refresh_token"];
	let tokenEndpointAuthMethodsSupported = ["client_secret_basic", "client_secret_post", "none"];
	let codeChallengeMethodsSupported = ["S256"];

	let openidConfiguration: Record<string, unknown> = {
		issuer: endpoints.issuer,
		authorization_endpoint: endpoints.authorizationEndpoint,
		token_endpoint: endpoints.tokenEndpoint,
		userinfo_endpoint: endpoints.userinfoEndpoint,
		jwks_uri: endpoints.jwksUri,
		response_types_supported: responseTypesSupported,
		subject_types_supported: ["public"],
		id_token_signing_alg_values_supported: ["ES256"],
		grant_types_supported: grantTypesSupported,
		token_endpoint_auth_methods_supported: tokenEndpointAuthMethodsSupported,
		code_challenge_methods_supported: codeChallengeMethodsSupported,
		scopes_supported: scopesSupported,
		claims_supported: [...claimsSupported],
	};

	let oauthMetadata: Record<string, unknown> = {
		issuer: endpoints.issuer,
		authorization_endpoint: endpoints.authorizationEndpoint,
		token_endpoint: endpoints.tokenEndpoint,
		jwks_uri: endpoints.jwksUri,
		response_types_supported: responseTypesSupported,
		grant_types_supported: grantTypesSupported,
		token_endpoint_auth_methods_supported: tokenEndpointAuthMethodsSupported,
		code_challenge_methods_supported: codeChallengeMethodsSupported,
		scopes_supported: scopesSupported,
	};

	let jwks = await publishKeySet(db, { now: parsed.now });

	return {
		openidConfiguration,
		oauthMetadata,
		jwks,
		version: jwks.keys.map((key) => String(key.kid)).join(","),
		maxAge: MAX_AGE_SECONDS,
	};
}

export interface ResolveUserInfoInput {
	subjectId: string;
	scopes: string[];
	now: number;
}

export type ResolveUserInfoResult =
	| { kind: "claims"; claims: Record<string, unknown> }
	| { kind: "unknown" };

let ResolveUserInfoSchema = s.object({
	subjectId: s.string(),
	scopes: s.array(s.string()),
	now: s.number(),
});

/**
 * Assembles the claims a subject's granted scopes carry for `/userinfo`. `sub` is always
 * present. A profile or email claim appears only when the subject actually holds a value
 * for it, the same omit-rather-than-null rule the token endpoint's own claim assembly
 * follows; a claim the tenant's schema has no column or table for — `address`, or a
 * `profile`-scope claim beyond the ones a subject can hold — never appears, regardless of
 * which scopes were granted.
 *
 * @param db - The tenant's database.
 * @param input - The subject id a verified access token named, and the scopes its grant
 * covers.
 * @returns The subject's claims, or that the subject id no longer resolves.
 */
export async function resolveUserInfo(
	db: Database,
	input: ResolveUserInfoInput,
): Promise<ResolveUserInfoResult> {
	let parsed = s.parse(ResolveUserInfoSchema, input);

	let subject = await db.find(subjects, { id: parsed.subjectId });
	if (!subject) return { kind: "unknown" };

	let grantedScopes = new Set(parsed.scopes);
	let claims: Record<string, unknown> = { sub: subject.id };

	if (grantedScopes.has("profile")) {
		for (let [claim, column] of Object.entries(PROFILE_CLAIM_COLUMNS)) {
			let value = subject[column];
			if (value !== null && value !== undefined) claims[claim] = value;
		}

		claims.updated_at = Math.floor(subject.updated_at / 1000);
	}

	if (grantedScopes.has("email")) {
		let primaryEmail = await db.findOne(subjectIdentifiers, {
			where: and(eq("subject_id", subject.id), eq("kind", "email"), eq("is_primary", true)),
		});

		if (primaryEmail) {
			claims.email = primaryEmail.value;
			claims.email_verified = primaryEmail.verified_at !== null;
		}
	}

	return { kind: "claims", claims };
}
