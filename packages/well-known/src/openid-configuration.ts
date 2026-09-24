/**
 * OpenID Connect Discovery 1.0 provider metadata: the RFC 8414 document plus the
 * members §3 adds, read with the §4.3 issuer check and served at the appended path
 * §4 fixes, so a provider and its relying parties share one mapping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";
import type { AuthorizationServerMetadata, ParseOptions } from "./oauth-authorization-server.js";
import type { WellKnownParseError } from "./parse-error.js";

import { defaults, readMetadata, writeMetadata } from "./lib/metadata.js";
import { issuerCheck, OPENID_PROVIDER_FIELDS } from "./lib/oauth-fields.js";

export type { ParseOptions } from "./oauth-authorization-server.js";

export const NAME = "openid-configuration";
export const MEDIA_TYPE = "application/json";

/**
 * OpenID Connect Discovery 1.0 §3, which extends the RFC 8414 members. OIDC Discovery
 * requires `RS256` among `idTokenSigningAlgValuesSupported`; the reader accepts a
 * provider publishing without it.
 *
 * @template Extensions - The members outside this list, validated by a schema on parse.
 */
export interface OpenIdProviderMetadata<
	Extensions extends object = {},
> extends AuthorizationServerMetadata<Extensions> {
	authorizationEndpoint: URL;
	jwksUri: URL;
	userinfoEndpoint: URL | null;
	endSessionEndpoint: URL | null;
	checkSessionIframe: URL | null;
	subjectTypesSupported: string[];
	idTokenSigningAlgValuesSupported: string[];
	claimsSupported: string[];
	promptValuesSupported: string[];
	acrValuesSupported: string[];
	requestParameterSupported: boolean;
	/** Absent in the document means `true` (§3). */
	requestUriParameterSupported: boolean;
	frontchannelLogoutSupported: boolean;
	frontchannelLogoutSessionSupported: boolean;
	backchannelLogoutSupported: boolean;
	backchannelLogoutSessionSupported: boolean;
}

/**
 * Reads provider metadata. A missing required member (`issuer`,
 * `authorization_endpoint`, `jwks_uri`, `response_types_supported`,
 * `subject_types_supported`, `id_token_signing_alg_values_supported`) or a different
 * issuer fails; members outside §3 land in `extensions`.
 *
 * @param text - The served JSON.
 * @param options - The expected issuer and an extension schema.
 * @template Extensions - The extension members the schema produces.
 * @example
 * let metadata = parse(body, { issuer: "https://op.example" });
 */
export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options: ParseOptions<Extensions> = {},
): Result<OpenIdProviderMetadata<Extensions>, WellKnownParseError> {
	return readMetadata(text, {
		format: NAME,
		table: OPENID_PROVIDER_FIELDS,
		extensions: options.extensions,
		check: issuerCheck(options.issuer),
	}) as Result<OpenIdProviderMetadata<Extensions>, WellKnownParseError>;
}

/**
 * Writes the document as its registered member names, leaving out `null` members,
 * empty lists and flags at their §3 default.
 *
 * @param document - The metadata to publish.
 */
export function stringify(document: OpenIdProviderMetadata<object>): string {
	return writeMetadata(document, OPENID_PROVIDER_FIELDS);
}

/**
 * Builds a document from the members an app sets; lists default to empty, URLs to
 * `null` and flags to their §3 default.
 *
 * @param document - The members the provider publishes.
 * @template Extensions - Members outside §3 the provider also publishes.
 */
export function define<Extensions extends object = {}>(
	document: Pick<
		OpenIdProviderMetadata<Extensions>,
		| "issuer"
		| "authorizationEndpoint"
		| "jwksUri"
		| "responseTypesSupported"
		| "subjectTypesSupported"
		| "idTokenSigningAlgValuesSupported"
	> &
		Partial<OpenIdProviderMetadata<Extensions>>,
): OpenIdProviderMetadata<Extensions> {
	return {
		...defaults(OPENID_PROVIDER_FIELDS),
		extensions: {},
		...document,
	} as OpenIdProviderMetadata<Extensions>;
}

/**
 * Provider metadata as a servable format, appended to the issuer (§4). Its `parse`
 * checks no issuer; a relying party reading a fetched document calls `parse` with one.
 */
export const openIdConfiguration: WellKnownFormat<OpenIdProviderMetadata<object>> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "append",
	cors: false,
	stringify,
	parse: (text) => parse(text),
};
