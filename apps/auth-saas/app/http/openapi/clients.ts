/**
 * The management API's operations for Clients and their secrets: the schemas each route's
 * handler parses with and the OpenAPI document publishes, so the two cannot drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import {
	AUTH_PROBLEMS,
	IDEMPOTENCY_DESCRIPTION,
	IDEMPOTENCY_PROBLEMS,
	LINK_HEADER,
	mergePatchBody,
	PAGING_PROBLEMS,
	PAGING_QUERY,
	requires,
	UNSUPPORTED_MEDIA_TYPE,
} from "~/app/http/openapi/shared";
import routes from "~/routes/management";

/** Whether a client holds a secret: a confidential one does, a public one never. */
const CLIENT_KIND = s.enum_(["confidential", "public"] as const);

/** How a client proves itself at the token endpoint; a public client presents `none`. */
const TOKEN_ENDPOINT_AUTH_METHOD = s.enum_([
	"client_secret_basic",
	"client_secret_post",
	"none",
] as const);

/** The algorithm a client's ID tokens are signed with. */
const ID_TOKEN_SIGNED_RESPONSE_ALG = s.enum_(["ES256", "RS256"] as const);

/**
 * A client's writable members: the body a registration sends whole, and the shape a
 * merge-patched client must still have, so both routes hold one set of rules.
 * `idTokenSignedResponseAlg` defaults to ES256 on registration.
 */
export const CLIENT_BODY_SCHEMA = s.object({
	name: s.string(),
	kind: CLIENT_KIND,
	redirectUris: s.array(s.string()),
	postLogoutRedirectUris: s.array(s.string()),
	grantTypes: s.array(s.string()),
	responseTypes: s.array(s.string()),
	scopes: s.array(s.string()),
	tokenEndpointAuthMethod: TOKEN_ENDPOINT_AUTH_METHOD,
	requireConsent: s.boolean(),
	idTokenSignedResponseAlg: s.optional(ID_TOKEN_SIGNED_RESPONSE_ALG),
});

/** The merge patch a client update reads: any writable member, a changed `kind` refused. */
const CLIENT_PATCH = s.object({
	name: s.optional(s.string()),
	kind: s.optional(CLIENT_KIND),
	redirectUris: s.optional(s.array(s.string())),
	postLogoutRedirectUris: s.optional(s.array(s.string())),
	grantTypes: s.optional(s.array(s.string())),
	responseTypes: s.optional(s.array(s.string())),
	scopes: s.optional(s.array(s.string())),
	tokenEndpointAuthMethod: s.optional(TOKEN_ENDPOINT_AUTH_METHOD),
	requireConsent: s.optional(s.boolean()),
	idTokenSignedResponseAlg: s.optional(ID_TOKEN_SIGNED_RESPONSE_ALG),
});

/** A client's whole record; timestamps are epoch milliseconds, `disabledAt` null while enabled. */
export const CLIENT = s
	.object({
		id: s.string(),
		name: s.string(),
		kind: CLIENT_KIND,
		redirectUris: s.array(s.string()),
		postLogoutRedirectUris: s.array(s.string()),
		grantTypes: s.array(s.string()),
		responseTypes: s.array(s.string()),
		scopes: s.array(s.string()),
		tokenEndpointAuthMethod: TOKEN_ENDPOINT_AUTH_METHOD,
		requireConsent: s.boolean(),
		createdAt: s.integer(),
		updatedAt: s.integer(),
		disabledAt: s.nullable(s.integer()),
		includePermissions: s.boolean(),
		idTokenSignedResponseAlg: ID_TOKEN_SIGNED_RESPONSE_ALG,
	})
	.meta({ id: "Client" });

/** One client as the list publishes it: its identity and status, never its redirect or grant configuration. */
export const CLIENT_SUMMARY = s
	.object({
		id: s.string(),
		name: s.string(),
		kind: CLIENT_KIND,
		tokenEndpointAuthMethod: TOKEN_ENDPOINT_AUTH_METHOD,
		createdAt: s.integer(),
		disabledAt: s.nullable(s.integer()),
	})
	.meta({ id: "ClientSummary" });

/** The params of every route naming one client. */
const CLIENT_PARAMS = s.object({ tenantId: s.string(), clientId: s.string() });

/** The refusals a client's redirect URIs, grant types, response types and auth method can draw. */
const CLIENT_RECORD_PROBLEMS = [
	"invalidRedirectUri",
	"invalidPostLogoutRedirectUri",
	"invalidGrantType",
	"invalidResponseType",
	"invalidAuthMethod",
] as const;

/** `POST /tenants/:tenantId/clients`: registers a client, answering a confidential one's secret once. */
export const CLIENTS_REGISTER = defineOperation("clientsRegister", routes.clientsRegister, {
	summary: "Register a client",
	description: `A confidential client's first secret is in the response and never readable again; a public client's is null. ${IDEMPOTENCY_DESCRIPTION}`,
	tags: ["Clients"],
	params: s.object({ tenantId: s.string() }),
	body: CLIENT_BODY_SCHEMA,
	responses: {
		201: {
			description: "The registered client and its one-time secret",
			body: s.object({ client: CLIENT, secret: s.nullable(s.string()) }),
		},
	},
	problems: [
		...AUTH_PROBLEMS,
		...IDEMPOTENCY_PROBLEMS,
		"validationFailed",
		"entitlementRequired",
		...CLIENT_RECORD_PROBLEMS,
	],
	security: requires("clients:write"),
});

/** `GET /tenants/:tenantId/clients`: a keyset page of the tenant's clients, newest first. */
export const CLIENTS_LIST = defineOperation("clientsList", routes.clientsList, {
	summary: "List clients",
	tags: ["Clients"],
	params: s.object({ tenantId: s.string() }),
	query: s.object({ ...PAGING_QUERY }),
	responses: {
		200: {
			description: "The page of clients",
			body: s.array(CLIENT_SUMMARY),
			headers: LINK_HEADER,
		},
	},
	problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS],
	security: requires("clients:write"),
});

/** `GET /tenants/:tenantId/clients/:clientId`: one client's whole record. */
export const CLIENTS_READ = defineOperation("clientsRead", routes.clientsRead, {
	summary: "Read a client",
	tags: ["Clients"],
	params: CLIENT_PARAMS,
	responses: { 200: { description: "The client", body: CLIENT } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("clients:write"),
});

/** `PATCH /tenants/:tenantId/clients/:clientId`: a merge patch of the client's writable record. */
export const CLIENTS_UPDATE = defineOperation("clientsUpdate", routes.clientsUpdate, {
	summary: "Update a client",
	description:
		"An RFC 7396 merge patch: send only the members that change; a list replaces the stored one whole. Changing kind is refused.",
	tags: ["Clients"],
	params: CLIENT_PARAMS,
	body: mergePatchBody(CLIENT_PATCH),
	responses: {
		200: { description: "The updated client", body: CLIENT },
		415: UNSUPPORTED_MEDIA_TYPE,
	},
	problems: [
		...AUTH_PROBLEMS,
		"validationFailed",
		"notFound",
		"kindImmutable",
		"entitlementRequired",
		...CLIENT_RECORD_PROBLEMS,
	],
	security: requires("clients:write"),
});

/** `POST /tenants/:tenantId/clients/:clientId/rotate-secret`: mints a successor secret and opens the incumbent's overlap window. */
export const CLIENTS_ROTATE_SECRET = defineOperation(
	"clientsRotateSecret",
	routes.clientsRotateSecret,
	{
		summary: "Rotate a client's secret",
		description: `The incumbent keeps verifying for windowDays (capped at 30) so callers can switch over. ${IDEMPOTENCY_DESCRIPTION}`,
		tags: ["Clients"],
		params: CLIENT_PARAMS,
		body: s.optional(s.object({ windowDays: s.optional(s.number()) })),
		responses: {
			200: {
				description: "The new secret, shown once, and when the incumbent stops verifying",
				body: s.object({
					secretId: s.string(),
					secret: s.string(),
					incumbentExpiresAt: s.nullable(s.integer()),
				}),
			},
		},
		problems: [
			...AUTH_PROBLEMS,
			...IDEMPOTENCY_PROBLEMS,
			"validationFailed",
			"notFound",
			"notConfidential",
			"tooManyLiveSecrets",
		],
		security: requires("clients:write"),
	},
);

/** `POST /tenants/:tenantId/clients/:clientId/secrets/:secretId/revoke`: closes one secret's window now. */
export const CLIENTS_REVOKE_SECRET = defineOperation(
	"clientsRevokeSecret",
	routes.clientsRevokeSecret,
	{
		summary: "Revoke a client secret",
		description: "A confidential client's last live secret cannot be revoked.",
		tags: ["Clients"],
		params: s.object({ tenantId: s.string(), clientId: s.string(), secretId: s.string() }),
		responses: { 204: { description: "The secret no longer verifies" } },
		problems: [...AUTH_PROBLEMS, "notFound", "lastLiveSecret"],
		security: requires("clients:write"),
	},
);

/** `POST /tenants/:tenantId/clients/:clientId/disable`: stops the client from authorizing. */
export const CLIENTS_DISABLE = defineOperation("clientsDisable", routes.clientsDisable, {
	summary: "Disable a client",
	tags: ["Clients"],
	params: CLIENT_PARAMS,
	responses: { 204: { description: "The client is disabled" } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("clients:write"),
});

/** `DELETE /tenants/:tenantId/clients/:clientId`: deletes the client and its secrets. */
export const CLIENTS_DELETE = defineOperation("clientsDelete", routes.clientsDelete, {
	summary: "Delete a client",
	tags: ["Clients"],
	params: CLIENT_PARAMS,
	responses: { 204: { description: "The client and its secrets are gone" } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("clients:write"),
});

/** Every operation in this area, in route-map order, for the document to list. */
export const CLIENTS_OPERATIONS = [
	CLIENTS_REGISTER,
	CLIENTS_LIST,
	CLIENTS_READ,
	CLIENTS_UPDATE,
	CLIENTS_ROTATE_SECRET,
	CLIENTS_REVOKE_SECRET,
	CLIENTS_DISABLE,
	CLIENTS_DELETE,
] as const;
