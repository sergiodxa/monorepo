/**
 * OAuth Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document-02):
 * the RFC 7591 client metadata a client publishes at the `https` URL it uses as its
 * `client_id`, with the reader an authorization server checks a fetched copy through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { success } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";
import type { JwkSet } from "./jwks.js";
import type { JsonObject } from "./lib/json.js";
import type { FieldTable } from "./lib/metadata.js";
import type { LocalizedString } from "./oauth-protected-resource.js";
import type { WellKnownParseError } from "./parse-error.js";

import { jwks } from "./jwks.js";
import { isObject, pointer } from "./lib/json.js";
import { defaults, readMetadata, writeMetadata } from "./lib/metadata.js";

export const NAME = "client-id-metadata-document";
export const MEDIA_TYPE = "application/json";

/**
 * The client authentication methods a document may declare (§4.1): `none` and the
 * methods proven with a key pair, since a published document can establish no shared
 * secret.
 */
export const TOKEN_ENDPOINT_AUTH_METHODS = [
	"none",
	"private_key_jwt",
	"tls_client_auth",
	"self_signed_tls_client_auth",
] as const;

export type TokenEndpointAuthMethod = (typeof TOKEN_ENDPOINT_AUTH_METHODS)[number];

/** The methods whose key the authorization server discovers through `jwks` or `jwks_uri`. */
const KEYED_METHODS: readonly string[] = ["private_key_jwt", "self_signed_tls_client_auth"];

/** The registered methods built on a shared secret, refused by name (§4.1). */
const SECRET_METHODS: readonly string[] = [
	"client_secret_post",
	"client_secret_basic",
	"client_secret_jwt",
];

/** Members that carry a shared secret, which a document must never hold (§4.1). */
const SECRET_MEMBERS = ["client_secret", "client_secret_expires_at"] as const;

/** Grant types that send the user back through a registered redirect URI (§4.2). */
const REDIRECT_GRANTS: readonly string[] = ["authorization_code", "implicit"];

/** Schemes a redirect URI may never use, since following one runs or embeds content. */
const UNSAFE_REDIRECT_SCHEMES: readonly string[] = ["javascript:", "data:", "vbscript:", "file:"];

/** The schemes a URL shown to the user or linked from the consent screen may use (§8.6). */
const WEB_SCHEMES: readonly string[] = ["https:", "http:"];

/** Every RFC 7591 §2 member this document types, by camelCase field. */
const FIELDS = {
	clientId: { wire: "client_id", kind: "text", required: true },
	redirectUris: { wire: "redirect_uris", kind: "strings" },
	tokenEndpointAuthMethod: { wire: "token_endpoint_auth_method", kind: "text" },
	grantTypes: { wire: "grant_types", kind: "strings", default: ["authorization_code"] },
	responseTypes: { wire: "response_types", kind: "strings", default: ["code"] },
	clientName: { wire: "client_name", kind: "localized" },
	clientUri: { wire: "client_uri", kind: "url" },
	logoUri: { wire: "logo_uri", kind: "url" },
	scope: { wire: "scope", kind: "tokens" },
	contacts: { wire: "contacts", kind: "strings" },
	tosUri: { wire: "tos_uri", kind: "url" },
	policyUri: { wire: "policy_uri", kind: "url" },
	jwksUri: { wire: "jwks_uri", kind: "url" },
	jwks: { wire: "jwks", kind: "object" },
	softwareId: { wire: "software_id", kind: "text" },
	softwareVersion: { wire: "software_version", kind: "text" },
	softwareStatement: { wire: "software_statement", kind: "text" },
} satisfies FieldTable;

/**
 * A client's published metadata. `clientId` and every redirect URI stay strings because
 * both are matched by simple string comparison (§3, §4.2); `scope` is the space-delimited
 * member read as a list.
 *
 * @template Extensions - The RFC 7591 members outside this list, validated by a schema on parse.
 */
export interface ClientIdMetadataDocument<Extensions extends object = {}> {
	/** The Client Identifier URL, exactly the URL the document is served at. */
	clientId: string;
	redirectUris: string[];
	/** An absent member reads as `none`: with no secret to present, the client is public. */
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	/** @default ["authorization_code"] */
	grantTypes: string[];
	/** @default ["code"] */
	responseTypes: string[];
	clientName: LocalizedString | null;
	clientUri: URL | null;
	logoUri: URL | null;
	scope: string[];
	contacts: string[];
	tosUri: URL | null;
	policyUri: URL | null;
	jwksUri: URL | null;
	/** Public keys only; serving the document publishes each key's public half. */
	jwks: JwkSet | null;
	softwareId: string | null;
	softwareVersion: string | null;
	/** A JWT asserting the client's provenance (§4.3), kept opaque. */
	softwareStatement: string | null;
	extensions: Extensions;
}

/**
 * How a fetched document is read.
 *
 * @template Extensions - The members the schema produces.
 */
export interface ParseOptions<Extensions extends object> {
	/** The URL the document was fetched from; its `client_id` must equal it, byte for byte (§4). */
	clientId: string;
	/** Validates the members outside the typed list; without one they stay unchecked. */
	extensions?: StandardSchemaV1<unknown, Extensions>;
}

/**
 * Whether a string is a valid Client Identifier URL (§3): `https`, a path, and no
 * userinfo, dot segments or fragment. It reads the raw string, so a dot segment the URL
 * parser would resolve away still fails; a query is allowed, though discouraged.
 *
 * @param value - A `client_id` as presented.
 * @example
 * isClientIdentifierUrl("https://app.example.com/client.json"); // true
 */
export function isClientIdentifierUrl(value: string): boolean {
	if (!/^https:\/\//i.test(value) || !URL.canParse(value)) return false;
	if (value.includes("#")) return false;

	let rest = value.slice("https://".length);
	let end = rest.search(/[/?]/);
	if (end === -1 || rest[end] !== "/") return false;
	if (rest.slice(0, end).includes("@")) return false;

	let path = rest.slice(end).split("?")[0] ?? "";
	return path.split("/").every((segment) => !/^(\.|%2e){1,2}$/i.test(segment));
}

/**
 * Whether a redirect URI can be registered: an absolute URL without a fragment (RFC 6749
 * §3.1.2) whose scheme leads somewhere a browser navigates to safely.
 *
 * @param value - One entry of `redirect_uris`.
 */
function isRedirectUri(value: string): boolean {
	if (!URL.canParse(value) || value.includes("#")) return false;
	return !UNSAFE_REDIRECT_SCHEMES.includes(new URL(value).protocol);
}

/**
 * Collects every §4.1 key material problem in `jwks`: no `keys` array, or a key carrying
 * a private or symmetric member.
 *
 * @param set - The decoded `jwks` member.
 * @param issues - Where problems are collected.
 */
function checkKeys(set: JsonObject, issues: WellKnownParseError.Issue[]): void {
	let keys = set.keys;
	if (!Array.isArray(keys)) {
		issues.push({ at: "/jwks/keys", message: '"jwks" has no "keys" array.' });
		return;
	}
	for (let [index, key] of keys.entries()) {
		if (!isObject(key)) {
			issues.push({
				at: pointer("jwks", "keys", index),
				message: `Key ${index} is not an object.`,
			});
			continue;
		}
		for (let member of ["d", "p", "q", "dp", "dq", "qi", "oth", "k"]) {
			if (member in key)
				issues.push({
					at: pointer("jwks", "keys", index, member),
					message: `Key ${index} carries the private member "${member}".`,
				});
		}
	}
}

/**
 * Collects the §4.1 authentication problems: a secret member, a method outside
 * {@link TOKEN_ENDPOINT_AUTH_METHODS}, both or neither key source for a keyed method, a
 * non-`https` `jwks_uri` and private key material.
 *
 * @param fields - The read fields.
 * @param issues - Where problems are collected.
 * @param body - The decoded document.
 */
function checkAuthentication(
	fields: Record<string, unknown>,
	issues: WellKnownParseError.Issue[],
	body: JsonObject,
): void {
	for (let member of SECRET_MEMBERS) {
		if (member in body)
			issues.push({
				at: pointer(member),
				message: `"${member}" is a shared secret, which a Client ID Metadata Document cannot carry.`,
			});
	}

	let method = (fields.tokenEndpointAuthMethod as string | null) ?? "none";
	if (SECRET_METHODS.includes(method)) {
		issues.push({
			at: "/token_endpoint_auth_method",
			message: `"${method}" authenticates with a shared secret, which a Client ID Metadata Document cannot establish.`,
		});
	} else if (!(TOKEN_ENDPOINT_AUTH_METHODS as readonly string[]).includes(method)) {
		issues.push({
			at: "/token_endpoint_auth_method",
			message: `"${method}" is not one of ${TOKEN_ENDPOINT_AUTH_METHODS.join(", ")}.`,
		});
	}

	let jwksUri = fields.jwksUri as URL | null;
	let set = fields.jwks as JsonObject | null;
	if (jwksUri !== null && set !== null)
		issues.push({ at: "", message: 'The document sets both "jwks" and "jwks_uri".' });
	if (KEYED_METHODS.includes(method) && jwksUri === null && set === null)
		issues.push({
			at: "/token_endpoint_auth_method",
			message: `"${method}" needs the client's public key in "jwks" or "jwks_uri".`,
		});
	if (jwksUri !== null && jwksUri.protocol !== "https:")
		issues.push({ at: "/jwks_uri", message: '"jwks_uri" is not an https URL.' });
	if (set !== null) checkKeys(set, issues);
}

/**
 * Collects the §4.2 and §8.6 URL problems: a redirect URI that cannot be registered, no
 * redirect URI for a redirect-based grant, and a display URL outside `http`/`https`.
 *
 * @param fields - The read fields.
 * @param issues - Where problems are collected.
 */
function checkUrls(fields: Record<string, unknown>, issues: WellKnownParseError.Issue[]): void {
	let redirectUris = fields.redirectUris as string[];
	for (let [index, uri] of redirectUris.entries()) {
		if (!isRedirectUri(uri))
			issues.push({
				at: pointer("redirect_uris", index),
				message: `"${uri}" is not an absolute redirect URI without a fragment.`,
			});
	}

	let grantTypes = fields.grantTypes as string[];
	if (redirectUris.length === 0 && grantTypes.some((grant) => REDIRECT_GRANTS.includes(grant)))
		issues.push({
			at: "/redirect_uris",
			message: `"redirect_uris" is empty, and grant types ${grantTypes.join(", ")} need one.`,
		});

	for (let name of ["clientUri", "logoUri", "tosUri", "policyUri"] as const) {
		let url = fields[name] as URL | null;
		if (url !== null && !WEB_SCHEMES.includes(url.protocol))
			issues.push({
				at: pointer(FIELDS[name].wire),
				message: `"${FIELDS[name].wire}" is not an http or https URL.`,
			});
	}
}

/**
 * Builds the read's draft check: the `client_id` shape (§3), its match with the fetched
 * URL when one is given (§4), and the credential and URL rules.
 *
 * @param expected - The URL the document was fetched from.
 */
function documentCheck(expected: string | undefined) {
	return (
		fields: Record<string, unknown>,
		issues: WellKnownParseError.Issue[],
		body: JsonObject,
	) => {
		let clientId = String(fields.clientId);
		if (!isClientIdentifierUrl(clientId))
			issues.push({
				at: "/client_id",
				message: `"${clientId}" is not an https URL with a path and no userinfo, dot segments or fragment.`,
			});
		else if (expected !== undefined && clientId !== expected)
			issues.push({
				at: "/client_id",
				message: `The document names client_id "${clientId}", not "${expected}".`,
			});
		checkAuthentication(fields, issues, body);
		checkUrls(fields, issues);
	};
}

/**
 * Reads a document through the field table and the draft's rules.
 *
 * @param text - The served JSON.
 * @param expected - The URL it was fetched from, when the match is checked.
 * @param extensions - The extension schema.
 * @template Extensions - The extension members the schema produces.
 */
function read<Extensions extends object>(
	text: string,
	expected: string | undefined,
	extensions: StandardSchemaV1<unknown, Extensions> | undefined,
): Result<ClientIdMetadataDocument<Extensions>, WellKnownParseError> {
	let result = readMetadata(text, {
		format: NAME,
		table: FIELDS,
		extensions,
		check: documentCheck(expected),
	});
	if (result.status === "failure") return result;
	return success({
		...result.data,
		tokenEndpointAuthMethod: result.data.tokenEndpointAuthMethod ?? "none",
	} as ClientIdMetadataDocument<Extensions>);
}

/**
 * Reads a fetched document. It fails on a `client_id` other than `options.clientId`, a
 * `client_secret*` member, a secret-based or unknown `token_endpoint_auth_method`, a
 * keyed method without exactly one key source, private key material, or a redirect URI
 * the client could not register; every RFC 7591 member outside the list lands in `extensions`.
 *
 * @param text - The served JSON.
 * @param options - The fetched URL and an extension schema.
 * @template Extensions - The extension members the schema produces.
 * @example
 * let client = parse(await response.text(), { clientId: url });
 */
export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options: ParseOptions<Extensions>,
): Result<ClientIdMetadataDocument<Extensions>, WellKnownParseError> {
	return read(text, options.clientId, options.extensions);
}

/**
 * Writes the document as its registered member names, leaving out `null` members, empty
 * optional lists and default grant and response types. `token_endpoint_auth_method` is
 * always written, since RFC 7591 reads an absent one as `client_secret_basic`, and
 * `jwks` carries each key's public half only.
 *
 * @param document - The metadata to publish.
 */
export function stringify(document: ClientIdMetadataDocument<object>): string {
	let set = document.jwks === null ? null : (JSON.parse(jwks.stringify(document.jwks)) as JwkSet);
	return writeMetadata({ ...document, jwks: set }, FIELDS);
}

/**
 * Builds a document from the members a client sets: `none` authentication, the RFC 7591
 * default grant and response types, empty lists, `null` single values and no extensions.
 *
 * @param document - The members the client publishes.
 * @template Extensions - Members outside the typed list the client also publishes.
 * @example
 * define({ clientId: "https://app.example.com/client.json", redirectUris: ["https://app.example.com/callback"] });
 */
export function define<Extensions extends object = {}>(
	document: Pick<ClientIdMetadataDocument<Extensions>, "clientId"> &
		Partial<ClientIdMetadataDocument<Extensions>>,
): ClientIdMetadataDocument<Extensions> {
	return {
		...defaults(FIELDS),
		tokenEndpointAuthMethod: "none",
		extensions: {},
		...document,
	} as ClientIdMetadataDocument<Extensions>;
}

/**
 * The document as a servable format, for `respond` from `./response` at the route behind
 * the client's own URL. Its `parse` applies every rule but the URL match, which a
 * fetching authorization server checks by calling `parse` with `clientId`.
 */
export const clientIdMetadataDocument: WellKnownFormat<ClientIdMetadataDocument<object>> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: false,
	stringify,
	parse: (text) => read(text, undefined, undefined),
};
