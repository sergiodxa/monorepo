/**
 * The API key operations of the API document: listing the team's keys, minting one and
 * revoking one. The request schemas here are the ones the controllers validate with, so
 * the published contract and the enforced one are the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { envelope, PAGE_QUERY, pageResponse } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import { typedId } from "~/app/services/typed-id";
import { apiKeyScopes } from "~/database/schema";
import routes from "~/routes/web";

/** The tag grouping every operation in this module. */
const TAGS = ["API keys"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** An API key's metadata as `serializeApiKey` writes it; the secret itself never appears. */
const API_KEY = s
	.object({
		id: resourceId("key"),
		name: s.string(),
		scopes: s.array(s.enum_(apiKeyScopes)),
		createdAt: epochMs(),
		lastUsedAt: s.nullable(epochMs()),
		expiresAt: s.nullable(epochMs()).meta({ description: "Null for a key that never expires" }),
		keyPrefix: s.string().meta({ description: "The key's first characters, to recognize it" }),
	})
	.meta({ id: "ApiKey" });

/** The body `POST /api/v1/api-keys` accepts; the handler then checks each scope is held. */
export const CREATE_API_KEY_BODY = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	scopes: s
		.array(s.enum_(apiKeyScopes))
		.refine((value) => value.length > 0, "At least one scope is required.")
		.meta({ description: "At least one scope, each held by the calling key" }),
	expiresAt: s.optional(
		s
			.string()
			.meta({ format: "date-time", description: "When the key stops working" })
			.refine((value: string) => Number.isFinite(new Date(value).getTime()), "Invalid date/time.")
			.transform((value: string) => new Date(value).getTime(), epochMs()),
	),
});

/** The path params naming one API key. */
export const API_KEY_ID_PARAMS = s.object({ apiKeyId: typedId("key") });

const API_KEYS_INDEX = defineOperation("apiKeysIndex", routes.api.v1.apiKeys.index, {
	summary: "List the team's API keys",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: { 200: pageResponse("A page of the team's API keys", { apiKeys: s.array(API_KEY) }) },
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["api-keys:read"] }],
});

/**
 * The minted secret is never stored for replay, so a retry after completion mints another
 * key: the only idempotency refusals are a malformed key and a retry while the first runs.
 */
const API_KEYS_CREATE = defineOperation("apiKeysCreate", routes.api.v1.apiKeys.create, {
	summary: "Create an API key",
	description:
		"Returns the plaintext key once, in `data.key`. An `Idempotency-Key` refuses a concurrent " +
		"duplicate, but a retry after the first request completes creates another key.",
	tags: TAGS,
	body: CREATE_API_KEY_BODY,
	responses: {
		201: {
			description: "The created key's metadata and its plaintext secret",
			body: envelope({
				apiKey: API_KEY,
				key: s.string().meta({ description: "The secret, shown only in this response" }),
			}),
		},
	},
	problems: [
		"validationError",
		"limitExceeded",
		...AUTH_PROBLEMS,
		"idempotencyKeyInvalid",
		"idempotencyKeyInUse",
	],
	security: [{ apiKey: ["api-keys:write"] }],
});

const API_KEY_DESTROY = defineOperation("apiKeyDestroy", routes.api.v1.apiKeys.destroy, {
	summary: "Revoke an API key",
	tags: TAGS,
	params: API_KEY_ID_PARAMS,
	responses: {
		200: { description: "The key is revoked", body: envelope({ deleted: s.literal(true) }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["api-keys:write"] }],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [API_KEYS_INDEX, API_KEYS_CREATE, API_KEY_DESTROY];
