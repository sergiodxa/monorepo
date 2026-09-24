/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728): the typed document, its reader
 * with the §3.3 resource check a caller cannot skip, its writer, `define` and the
 * metadata URL, so a client learns which authorization server protects an API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { WellKnownFormat } from "./format.js";
import type { FieldTable } from "./lib/metadata.js";
import type { WellKnownParseError } from "./parse-error.js";

import { sameIdentifier } from "./lib/identifier.js";
import { defaults, readMetadata, writeMetadata } from "./lib/metadata.js";
import { wellKnownUrl } from "./well-known-url.js";

export const NAME = "oauth-protected-resource";
export const MEDIA_TYPE = "application/json";

/** How a resource accepts a bearer token (RFC 6750 §2). */
export type BearerMethod = "header" | "body" | "query";

/**
 * RFC 9728 §2, in the order the RFC lists its members.
 *
 * @template Extensions - The members outside this list, validated by a schema on parse.
 */
export interface ProtectedResourceMetadata<Extensions extends object = {}> {
	resource: URL;
	/** Issuer identifiers of the authorization servers whose tokens the resource accepts. */
	authorizationServers: URL[];
	jwksUri: URL | null;
	scopesSupported: string[];
	bearerMethodsSupported: BearerMethod[];
	resourceSigningAlgValuesSupported: string[];
	resourceName: LocalizedString | null;
	resourceDocumentation: URL | null;
	resourcePolicyUri: URL | null;
	resourceTosUri: URL | null;
	tlsClientCertificateBoundAccessTokens: boolean;
	authorizationDetailsTypesSupported: string[];
	dpopSigningAlgValuesSupported: string[];
	dpopBoundAccessTokensRequired: boolean;
	/** A JWT carrying the metadata, kept opaque. */
	signedMetadata: string | null;
	extensions: Extensions;
}

/** A value with its untagged form and its `#`-tagged variants (§2.1), keyed by language tag. */
export interface LocalizedString {
	value: string;
	translations: Record<string, string>;
}

/**
 * How a fetched metadata document is read.
 *
 * @template Extensions - The members the schema produces.
 */
export interface ParseOptions<Extensions extends object> {
	/** The identifier the metadata URL was built from, or the requested URL (§3.3). */
	resource: URL | string;
	/**
	 * Accept a `resource` that is a same-origin, segment-aligned prefix of `resource`,
	 * for metadata found through a challenge on a URL below the resource.
	 * @default "exact"
	 */
	match?: "exact" | "prefix";
	/** Validates the members outside the standard list; without one they stay unchecked. */
	extensions?: StandardSchemaV1<unknown, Extensions>;
}

/** Every RFC 9728 member, by camelCase field. */
const FIELDS = {
	resource: { wire: "resource", kind: "url", required: true },
	authorizationServers: { wire: "authorization_servers", kind: "urls" },
	jwksUri: { wire: "jwks_uri", kind: "url" },
	scopesSupported: { wire: "scopes_supported", kind: "strings" },
	bearerMethodsSupported: {
		wire: "bearer_methods_supported",
		kind: "strings",
		values: ["header", "body", "query"],
	},
	resourceSigningAlgValuesSupported: {
		wire: "resource_signing_alg_values_supported",
		kind: "strings",
	},
	resourceName: { wire: "resource_name", kind: "localized" },
	resourceDocumentation: { wire: "resource_documentation", kind: "url" },
	resourcePolicyUri: { wire: "resource_policy_uri", kind: "url" },
	resourceTosUri: { wire: "resource_tos_uri", kind: "url" },
	tlsClientCertificateBoundAccessTokens: {
		wire: "tls_client_certificate_bound_access_tokens",
		kind: "boolean",
	},
	authorizationDetailsTypesSupported: {
		wire: "authorization_details_types_supported",
		kind: "strings",
	},
	dpopSigningAlgValuesSupported: { wire: "dpop_signing_alg_values_supported", kind: "strings" },
	dpopBoundAccessTokensRequired: { wire: "dpop_bound_access_tokens_required", kind: "boolean" },
	signedMetadata: { wire: "signed_metadata", kind: "text" },
} satisfies FieldTable;

/**
 * Whether a published resource is a same-origin, segment-aligned prefix of the one
 * requested: `https://api.example/v1` covers `https://api.example/v1/items`, never
 * `https://api.example/v10`.
 *
 * @param published - The document's `resource`.
 * @param requested - The URL the client asked about.
 */
function coversResource(published: URL, requested: URL): boolean {
	if (published.origin !== requested.origin) return false;
	if (sameIdentifier(published, requested)) return true;
	let base = published.pathname.endsWith("/") ? published.pathname : `${published.pathname}/`;
	return requested.pathname.startsWith(base);
}

/**
 * Reads protected resource metadata fetched for a resource. The published `resource`
 * must equal the expected one (or, with `match: "prefix"`, cover it); a mismatch, a
 * missing `resource`, or a malformed member fails. Members outside §2 land in
 * `extensions`.
 *
 * @param text - The served JSON.
 * @param options - The expected resource, how to match it, and an extension schema.
 * @template Extensions - The extension members the schema produces.
 * @example
 * let metadata = parse(body, { resource: "https://api.example/v1" });
 */
export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options: ParseOptions<Extensions>,
): Result<ProtectedResourceMetadata<Extensions>, WellKnownParseError> {
	let expected = new URL(options.resource);
	return readMetadata(text, {
		format: NAME,
		table: FIELDS,
		extensions: options.extensions,
		check(fields, issues) {
			let published = fields.resource as URL;
			let matches =
				options.match === "prefix"
					? coversResource(published, expected)
					: sameIdentifier(published, expected);
			if (matches) return;
			issues.push({
				at: "/resource",
				message: `The document names resource "${published.href}", not "${expected.href}".`,
			});
		},
	}) as Result<ProtectedResourceMetadata<Extensions>, WellKnownParseError>;
}

/**
 * Writes the document as its registered member names, leaving out `null` members,
 * empty lists and `false` flags; a localized name writes its tagged variants beside it.
 *
 * @param document - The metadata to publish.
 */
export function stringify(document: ProtectedResourceMetadata<object>): string {
	return writeMetadata(document, FIELDS);
}

/**
 * Builds a document from the members an app sets. Lists default to empty, URLs to
 * `null`, booleans to `false`; `bearerMethodsSupported` to `["header"]`, the one method
 * OAuth 2.1 and MCP both allow.
 *
 * @param document - The members the resource publishes.
 * @template Extensions - Members outside §2 the resource also publishes.
 * @example
 * define({ resource: new URL("https://api.example/v1"), scopesSupported: ["read"] });
 */
export function define<Extensions extends object = {}>(
	document: Pick<ProtectedResourceMetadata<Extensions>, "resource"> &
		Partial<ProtectedResourceMetadata<Extensions>>,
): ProtectedResourceMetadata<Extensions> {
	return {
		...defaults(FIELDS),
		bearerMethodsSupported: ["header"],
		extensions: {},
		...document,
	} as ProtectedResourceMetadata<Extensions>;
}

/**
 * Where a resource's metadata is served, with the suffix inserted before its path
 * (§3.1).
 *
 * @param resource - The resource identifier.
 * @example
 * metadataUrl("https://api.example.com/v1");
 * // https://api.example.com/.well-known/oauth-protected-resource/v1
 */
export function metadataUrl(resource: URL | string): URL {
	return wellKnownUrl(resource, NAME, "insert");
}

/**
 * Protected resource metadata as a servable format. Its `parse` reads the structure
 * alone; a client reading a fetched document calls `parse` with the resource it
 * expected.
 */
export const protectedResourceMetadata: WellKnownFormat<ProtectedResourceMetadata<object>> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: false,
	stringify,
	parse: (text) =>
		readMetadata(text, { format: NAME, table: FIELDS }) as Result<
			ProtectedResourceMetadata<object>,
			WellKnownParseError
		>,
};
