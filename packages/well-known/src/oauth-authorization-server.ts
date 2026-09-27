/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414): the typed document, its reader
 * with the §3.3 issuer check, its writer and `define`, so a server publishes and a
 * client reads the same member names from one mapping table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { WellKnownFormat } from "./format.js";
import type { WellKnownParseError } from "./parse-error.js";

import { defaults, readMetadata, writeMetadata } from "./lib/metadata.js";
import { AUTHORIZATION_SERVER_FIELDS, issuerCheck } from "./lib/oauth-fields.js";

export const NAME = "oauth-authorization-server";
export const MEDIA_TYPE = "application/json";

/**
 * RFC 8414 §2 plus the registry members an app in this repo publishes. `issuer` is a
 * string because it is compared as published and carried verbatim in tokens' `iss`.
 *
 * @template Extensions - The members outside this list, validated by a schema on parse.
 */
export interface AuthorizationServerMetadata<Extensions extends object = {}> {
	issuer: string;
	authorizationEndpoint: URL | null;
	tokenEndpoint: URL | null;
	jwksUri: URL | null;
	registrationEndpoint: URL | null;
	revocationEndpoint: URL | null;
	introspectionEndpoint: URL | null;
	/** RFC 8628. */
	deviceAuthorizationEndpoint: URL | null;
	/** RFC 9126. */
	pushedAuthorizationRequestEndpoint: URL | null;
	scopesSupported: string[];
	responseTypesSupported: string[];
	responseModesSupported: string[];
	grantTypesSupported: string[];
	tokenEndpointAuthMethodsSupported: string[];
	tokenEndpointAuthSigningAlgValuesSupported: string[];
	revocationEndpointAuthMethodsSupported: string[];
	introspectionEndpointAuthMethodsSupported: string[];
	codeChallengeMethodsSupported: string[];
	uiLocalesSupported: string[];
	serviceDocumentation: URL | null;
	opPolicyUri: URL | null;
	opTosUri: URL | null;
	/** RFC 9207. */
	authorizationResponseIssParameterSupported: boolean;
	/** RFC 9728 §4. */
	protectedResources: URL[];
	/** A JWT carrying the metadata, kept opaque. */
	signedMetadata: string | null;
	extensions: Extensions;
}

/**
 * How a metadata document is read.
 *
 * @template Extensions - The members the schema produces.
 */
export interface ParseOptions<Extensions extends object> {
	/** The issuer the document was fetched for; a different `issuer` fails (§3.3). */
	issuer?: URL | string;
	/** Validates the members outside the standard list; without one they stay unchecked. */
	extensions?: StandardSchemaV1<unknown, Extensions>;
}

/**
 * Reads authorization server metadata. Absent lists read as empty and absent URLs as
 * `null`; members outside RFC 8414 land in `extensions`. A missing `issuer` or
 * `response_types_supported`, a malformed member, or a different issuer fails.
 *
 * @param text - The served JSON.
 * @param options - The expected issuer and an extension schema.
 * @template Extensions - The extension members the schema produces.
 * @example
 * let metadata = parse(await response.text(), { issuer: "https://as.example" });
 */
export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options: ParseOptions<Extensions> = {},
): Result<AuthorizationServerMetadata<Extensions>, WellKnownParseError> {
	return readMetadata(text, {
		format: NAME,
		table: AUTHORIZATION_SERVER_FIELDS,
		extensions: options.extensions,
		check: issuerCheck(options.issuer),
	}) as Result<AuthorizationServerMetadata<Extensions>, WellKnownParseError>;
}

/**
 * Writes the document as its registered member names, leaving out `null` members,
 * optional empty lists and `false` flags. `response_types_supported` is REQUIRED, so
 * it is written even when empty and the output always passes {@link parse}.
 *
 * @param document - The metadata to publish.
 */
export function stringify(document: AuthorizationServerMetadata<object>): string {
	return writeMetadata(document, AUTHORIZATION_SERVER_FIELDS);
}

/**
 * Builds a document from the members an app sets; lists default to empty, URLs to
 * `null`, flags to `false` and extensions to none.
 *
 * @param document - The members the app publishes.
 * @template Extensions - Members outside RFC 8414 the app also publishes.
 * @example
 * define({ issuer: "https://as.example", responseTypesSupported: ["code"] });
 */
export function define<Extensions extends object = {}>(
	document: Pick<AuthorizationServerMetadata<Extensions>, "issuer" | "responseTypesSupported"> &
		Partial<AuthorizationServerMetadata<Extensions>>,
): AuthorizationServerMetadata<Extensions> {
	return {
		...defaults(AUTHORIZATION_SERVER_FIELDS),
		extensions: {},
		...document,
	} as AuthorizationServerMetadata<Extensions>;
}

/**
 * RFC 8414 metadata as a servable format. Its `parse` checks no issuer; a client
 * reading a fetched document calls `parse` with `issuer`.
 */
export const authorizationServerMetadata: WellKnownFormat<AuthorizationServerMetadata<object>> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: false,
	stringify,
	parse: (text) => parse(text),
};
