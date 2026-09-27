/**
 * The management API's operations for API keys: the schemas each route's
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
	PAGING_PROBLEMS,
	PAGING_QUERY,
	requires,
} from "~/app/http/openapi/shared";
import routes from "~/routes/management";

/**
 * One API key as every route publishes it: its hint, never its value. Timestamps are
 * epoch milliseconds; `lastUsedAt`, `revokedAt` and `revokedReason` are null until they happen.
 */
export const API_KEY = s
	.object({
		id: s.string(),
		subjectId: s.string(),
		name: s.string(),
		hint: s.string(),
		scopes: s.array(s.string()),
		createdAt: s.integer(),
		expiresAt: s.integer(),
		lastUsedAt: s.nullable(s.integer()),
		revokedAt: s.nullable(s.integer()),
		revokedReason: s.nullable(s.string()),
	})
	.meta({ id: "ApiKey" });

/** The params of every route naming one key. */
const API_KEY_PARAMS = s.object({ tenantId: s.string(), keyId: s.string() });

/** `POST /tenants/:tenantId/api-keys`: mints a key for a subject, narrowed to scopes it already holds. */
export const API_KEYS_CREATE = defineOperation("apiKeysCreate", routes.apiKeysCreate, {
	summary: "Create an API key",
	description: `The key's value is in the response and never readable again. Every scope must be one the subject holds, and the tenant's key prefix must be set. ${IDEMPOTENCY_DESCRIPTION}`,
	tags: ["API keys"],
	params: s.object({ tenantId: s.string() }),
	body: s.object({
		subjectId: s.string(),
		name: s.string(),
		scopes: s.array(s.string()),
		expiresAt: s.optional(s.number().meta({ description: "Epoch milliseconds" })),
	}),
	responses: {
		201: {
			description: "The new key and its one-time value",
			body: s.object({ key: API_KEY, value: s.string() }),
		},
	},
	problems: [
		...AUTH_PROBLEMS,
		...IDEMPOTENCY_PROBLEMS,
		"validationFailed",
		"prefixNotSet",
		"entitlementRequired",
		"scopeNotHeld",
		"expiryTooFar",
	],
	security: requires("keys:write"),
});

/** `GET /tenants/:tenantId/api-keys`: a keyset page of one subject's keys. */
export const API_KEYS_LIST = defineOperation("apiKeysList", routes.apiKeysList, {
	summary: "List a subject's API keys",
	tags: ["API keys"],
	params: s.object({ tenantId: s.string() }),
	query: s.object({ subjectId: s.string(), ...PAGING_QUERY }),
	responses: {
		200: { description: "The page of keys", body: s.array(API_KEY), headers: LINK_HEADER },
	},
	problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS, "validationFailed"],
	security: requires("keys:write"),
});

/** `GET /tenants/:tenantId/api-keys/:keyId`: one key's record. */
export const API_KEYS_READ = defineOperation("apiKeysRead", routes.apiKeysRead, {
	summary: "Read an API key",
	tags: ["API keys"],
	params: API_KEY_PARAMS,
	responses: { 200: { description: "The key", body: API_KEY } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("keys:write"),
});

/** `POST /tenants/:tenantId/api-keys/:keyId/rotate`: mints a successor while the incumbent keeps verifying for the overlap. */
export const API_KEYS_ROTATE = defineOperation("apiKeysRotate", routes.apiKeysRotate, {
	summary: "Rotate an API key",
	description: `The successor's value is in the response and never readable again; the incumbent keeps verifying until incumbentExpiresAt. ${IDEMPOTENCY_DESCRIPTION}`,
	tags: ["API keys"],
	params: API_KEY_PARAMS,
	body: s.optional(s.object({ overlap: s.optional(s.number()) })),
	responses: {
		200: {
			description: "The successor key, its one-time value, and when the incumbent expires",
			body: s.object({ key: API_KEY, value: s.string(), incumbentExpiresAt: s.integer() }),
		},
	},
	problems: [
		...AUTH_PROBLEMS,
		...IDEMPOTENCY_PROBLEMS,
		"validationFailed",
		"notFound",
		"prefixNotSet",
		"entitlementRequired",
		"overlapTooLong",
	],
	security: requires("keys:write"),
});

/** `POST /tenants/:tenantId/api-keys/:keyId/revoke`: stops the key verifying, recording why. */
export const API_KEYS_REVOKE = defineOperation("apiKeysRevoke", routes.apiKeysRevoke, {
	summary: "Revoke an API key",
	tags: ["API keys"],
	params: API_KEY_PARAMS,
	body: s.object({ reason: s.string() }),
	responses: { 204: { description: "The key no longer verifies" } },
	problems: [...AUTH_PROBLEMS, "validationFailed", "notFound"],
	security: requires("keys:write"),
});

/** Every operation in this area, in route-map order, for the document to list. */
export const API_KEYS_OPERATIONS = [
	API_KEYS_CREATE,
	API_KEYS_LIST,
	API_KEYS_READ,
	API_KEYS_ROTATE,
	API_KEYS_REVOKE,
] as const;
