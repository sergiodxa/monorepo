/**
 * Discovery and `/userinfo`: the read-only surfaces that describe a tenant to the clients
 * that use it. `publishMetadata` reads the tenant facts and key set in one call, and both
 * metadata documents are built from those same facts, so they never disagree.
 * `resolveUserInfo` assembles the claims a subject's granted scopes carry, omitting a
 * claim rather than nulling it whenever the tenant's schema has nowhere for its value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthorizationServerMetadata } from "@sdxc/well-known/oauth-authorization-server";
import type { OpenIdProviderMetadata } from "@sdxc/well-known/openid-configuration";
import type { Database } from "remix/data-table";

import { define as defineAuthorizationServerMetadata } from "@sdxc/well-known/oauth-authorization-server";
import { define as defineOpenIdConfiguration } from "@sdxc/well-known/openid-configuration";
import * as s from "remix/data-schema";
import { and, eq } from "remix/data-table";

import type { PublishedKeySet } from "./signing-keys";
import type { SubjectRow } from "./subjects";

import { clients } from "./clients";
import { scopes } from "./consent";
import { DEVICE_CODE_GRANT_TYPE } from "./device-authorization";
import { resolveRoleAndPermissionClaims } from "./roles";
import { sessions } from "./sessions";
import { publishKeySet, SIGNING_ALGORITHMS } from "./signing-keys";
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
	/** Whether this tenant currently holds the device grant add-on. */
	hasDeviceGrant: boolean;
}

/**
 * The tenant facts both discovery documents are built from, in plain values so the
 * result crosses the Durable Object's RPC boundary; {@link openIdConfigurationFor} and
 * {@link authorizationServerMetadataFor} turn it into the typed documents.
 */
export interface PublishMetadataResult {
	issuer: string;
	scopesSupported: string[];
	claimsSupported: string[];
	hasDeviceGrant: boolean;
	jwks: PublishedKeySet;
	/** How long the documents may be cached for, in seconds. */
	maxAge: number;
}

let PublishMetadataSchema = s.object({
	now: s.number(),
	issuer: s.string(),
	hasDeviceGrant: s.boolean(),
});

/**
 * Reads the facts both metadata documents and the JWKS document are built from in one
 * call, so a cold cache costs one round trip rather than three.
 *
 * @param db - The tenant's database.
 * @param input - The clock the key set's publish window is measured against, the
 * issuer the Worker resolved for this tenant's hostname, and whether this tenant
 * currently holds the device grant add-on, which is what gates whether
 * `device_authorization_endpoint` and its grant type URN appear at all.
 * @returns The tenant's scope and claim catalog, the published key set, and how long
 * the documents may be cached for.
 */
export async function publishMetadata(
	db: Database,
	input: PublishMetadataInput,
): Promise<PublishMetadataResult> {
	let parsed = s.parse(PublishMetadataSchema, input);

	let scopeRows = await db.findMany(scopes);

	let claimsSupported = new Set(REGISTERED_CLAIMS);
	for (let row of scopeRows) for (let claim of row.claims as string[]) claimsSupported.add(claim);

	return {
		issuer: parsed.issuer,
		scopesSupported: scopeRows.map((row) => row.name),
		claimsSupported: [...claimsSupported],
		hasDeviceGrant: parsed.hasDeviceGrant,
		jwks: await publishKeySet(db, { now: parsed.now }),
		maxAge: MAX_AGE_SECONDS,
	};
}

/**
 * The members the OpenID configuration and the RFC 8414 document share, built once so
 * the two documents can never disagree about an endpoint or a supported value.
 */
function sharedMembers(published: PublishMetadataResult) {
	let endpoint = (path: string) => new URL(path, published.issuer);

	return {
		issuer: published.issuer,
		authorizationEndpoint: endpoint("/authorize"),
		tokenEndpoint: endpoint("/oauth/token"),
		jwksUri: endpoint("/.well-known/jwks.json"),
		deviceAuthorizationEndpoint: published.hasDeviceGrant
			? endpoint("/oauth/device_authorization")
			: null,
		responseTypesSupported: ["code"],
		grantTypesSupported: published.hasDeviceGrant
			? ["authorization_code", "refresh_token", DEVICE_CODE_GRANT_TYPE]
			: ["authorization_code", "refresh_token"],
		tokenEndpointAuthMethodsSupported: ["client_secret_basic", "client_secret_post", "none"],
		codeChallengeMethodsSupported: ["S256"],
		scopesSupported: published.scopesSupported,
	};
}

/**
 * The tenant's OpenID Connect discovery document. It lists RS256, which OIDC Discovery
 * requires, beside ES256; `request_uri` is stated unsupported, since OIDC Discovery reads
 * an absent member as supported.
 *
 * @param published - The facts {@link publishMetadata} read.
 * @returns The document `/.well-known/openid-configuration` serves.
 */
export function openIdConfigurationFor(published: PublishMetadataResult): OpenIdProviderMetadata {
	return defineOpenIdConfiguration({
		...sharedMembers(published),
		userinfoEndpoint: new URL("/userinfo", published.issuer),
		subjectTypesSupported: ["public"],
		idTokenSigningAlgValuesSupported: SIGNING_ALGORITHMS,
		claimsSupported: published.claimsSupported,
		requestUriParameterSupported: false,
	});
}

/**
 * The tenant's RFC 8414 authorization server metadata, listing `/userinfo` under
 * `protected_resources` so a client finds the resource this server issues tokens for.
 *
 * @param published - The facts {@link publishMetadata} read.
 * @returns The document `/.well-known/oauth-authorization-server` serves.
 */
export function authorizationServerMetadataFor(
	published: PublishMetadataResult,
): AuthorizationServerMetadata {
	return defineAuthorizationServerMetadata({
		...sharedMembers(published),
		protectedResources: [new URL("/userinfo", published.issuer)],
	});
}

export interface ResolveUserInfoInput {
	subjectId: string;
	scopes: string[];
	now: number;
	/** The verified access token's own session, read for a `roles` claim's active organization. */
	sessionId?: string;
	/** The verified access token's own client, read for whether its `include_permissions` switch is on. */
	clientId?: string;
}

/** A userinfo claim value: every claim this endpoint assembles is one of these. */
export type ClaimValue = string | number | boolean | string[];

export type ResolveUserInfoResult =
	| { kind: "claims"; claims: Record<string, ClaimValue> }
	| { kind: "unknown" };

let ResolveUserInfoSchema = s.object({
	subjectId: s.string(),
	scopes: s.array(s.string()),
	now: s.number(),
	sessionId: s.optional(s.string()),
	clientId: s.optional(s.string()),
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
 * @param input - The subject id a verified access token named, the scopes its grant
 * covers, and its session and client, for the `roles` and `permissions` claims.
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
	let claims: Record<string, ClaimValue> = { sub: subject.id };

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

	if (parsed.sessionId) {
		let session = await db.find(sessions, { id: parsed.sessionId });
		let resolved = await resolveRoleAndPermissionClaims(db, {
			subjectId: subject.id,
			activeOrganizationId: session?.active_organization_id ?? null,
		});

		claims.roles = resolved.roleKeys;

		if (parsed.clientId) {
			let client = await db.find(clients, { id: parsed.clientId });
			if (client?.include_permissions) claims.permissions = resolved.permissionKeys;
		}
	}

	return { kind: "claims", claims };
}
