/**
 * The management API's operations for Webhook endpoints and their deliveries: the schemas each route's
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

/**
 * A webhook endpoint's writable members: the body a registration sends whole, and the
 * shape a merge-patched endpoint must still have, so both routes hold one set of rules.
 */
export const WEBHOOK_ENDPOINT_BODY_SCHEMA = s.object({
	url: s.string(),
	description: s.string(),
	eventTypes: s.array(s.string()),
});

/** The merge patch an endpoint update reads: any writable member. */
const WEBHOOK_ENDPOINT_PATCH = s.object({
	url: s.optional(s.string()),
	description: s.optional(s.string()),
	eventTypes: s.optional(s.array(s.string())),
});

/**
 * One webhook endpoint as every route publishes it, never its signing secret. Timestamps
 * are epoch milliseconds; `disabledAt` and `disabledReason` are null while it is enabled.
 */
export const WEBHOOK_ENDPOINT = s
	.object({
		id: s.string(),
		url: s.string(),
		description: s.string(),
		eventTypes: s.array(s.string()),
		createdAt: s.integer(),
		updatedAt: s.integer(),
		previousSecretExpiresAt: s.nullable(s.integer()),
		disabledAt: s.nullable(s.integer()),
		disabledReason: s.nullable(s.string()),
		consecutiveFailures: s.integer(),
	})
	.meta({ id: "WebhookEndpoint" });

/** One delivery as the log publishes it, never its signed payload; timestamps are epoch milliseconds. */
export const WEBHOOK_DELIVERY = s
	.object({
		id: s.string(),
		endpointId: s.string(),
		eventType: s.string(),
		sequence: s.integer(),
		status: s.enum_(["pending", "delivered", "exhausted"] as const),
		attempts: s.integer(),
		nextAttemptAt: s.nullable(s.integer()),
		lastStatus: s.nullable(s.integer()),
		lastError: s.nullable(s.string()),
		lastAttemptAt: s.nullable(s.integer()),
		deliveredAt: s.nullable(s.integer()),
		createdAt: s.integer(),
		replayOf: s.nullable(s.string()),
	})
	.meta({ id: "WebhookDelivery" });

/** The params of every route naming one endpoint. */
const ENDPOINT_PARAMS = s.object({ tenantId: s.string(), endpointId: s.string() });

/** The refusals an endpoint's URL and event types can draw. */
const ENDPOINT_RECORD_PROBLEMS = ["invalidUrl", "unknownEventType"] as const;

/** An endpoint and its signing secret, shown once. */
const ENDPOINT_WITH_SECRET = s.object({ endpoint: WEBHOOK_ENDPOINT, secret: s.string() });

/** `POST /tenants/:tenantId/webhook-endpoints`: registers an endpoint, answering its signing secret once. */
export const WEBHOOK_ENDPOINTS_REGISTER = defineOperation(
	"webhookEndpointsRegister",
	routes.webhookEndpointsRegister,
	{
		summary: "Register a webhook endpoint",
		description: `The signing secret is in the response and never readable again. ${IDEMPOTENCY_DESCRIPTION}`,
		tags: ["Webhook endpoints"],
		params: s.object({ tenantId: s.string() }),
		body: WEBHOOK_ENDPOINT_BODY_SCHEMA,
		responses: {
			201: { description: "The endpoint and its one-time secret", body: ENDPOINT_WITH_SECRET },
		},
		problems: [
			...AUTH_PROBLEMS,
			...IDEMPOTENCY_PROBLEMS,
			"validationFailed",
			"entitlementRequired",
			...ENDPOINT_RECORD_PROBLEMS,
		],
		security: requires("webhooks:write"),
	},
);

/** `GET /tenants/:tenantId/webhook-endpoints`: a keyset page of the tenant's endpoints, newest first. */
export const WEBHOOK_ENDPOINTS_LIST = defineOperation(
	"webhookEndpointsList",
	routes.webhookEndpointsList,
	{
		summary: "List webhook endpoints",
		tags: ["Webhook endpoints"],
		params: s.object({ tenantId: s.string() }),
		query: s.object({ ...PAGING_QUERY }),
		responses: {
			200: {
				description: "The page of endpoints",
				body: s.array(WEBHOOK_ENDPOINT),
				headers: LINK_HEADER,
			},
		},
		problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS],
		security: requires("webhooks:write"),
	},
);

/** `GET /tenants/:tenantId/webhook-endpoints/:endpointId`: one endpoint's record. */
export const WEBHOOK_ENDPOINTS_READ = defineOperation(
	"webhookEndpointsRead",
	routes.webhookEndpointsRead,
	{
		summary: "Read a webhook endpoint",
		tags: ["Webhook endpoints"],
		params: ENDPOINT_PARAMS,
		responses: { 200: { description: "The endpoint", body: WEBHOOK_ENDPOINT } },
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("webhooks:write"),
	},
);

/** `PATCH /tenants/:tenantId/webhook-endpoints/:endpointId`: a merge patch of the endpoint's writable record. */
export const WEBHOOK_ENDPOINTS_UPDATE = defineOperation(
	"webhookEndpointsUpdate",
	routes.webhookEndpointsUpdate,
	{
		summary: "Update a webhook endpoint",
		description:
			"An RFC 7396 merge patch: send only the members that change; eventTypes replaces the stored list whole.",
		tags: ["Webhook endpoints"],
		params: ENDPOINT_PARAMS,
		body: mergePatchBody(WEBHOOK_ENDPOINT_PATCH),
		responses: {
			200: { description: "The updated endpoint", body: WEBHOOK_ENDPOINT },
			415: UNSUPPORTED_MEDIA_TYPE,
		},
		problems: [
			...AUTH_PROBLEMS,
			"validationFailed",
			"notFound",
			"entitlementRequired",
			...ENDPOINT_RECORD_PROBLEMS,
		],
		security: requires("webhooks:write"),
	},
);

/** `POST /tenants/:tenantId/webhook-endpoints/:endpointId/rotate-secret`: mints a successor secret, the incumbent verifying for a week. */
export const WEBHOOK_ENDPOINTS_ROTATE_SECRET = defineOperation(
	"webhookEndpointsRotateSecret",
	routes.webhookEndpointsRotateSecret,
	{
		summary: "Rotate a webhook endpoint's signing secret",
		description: `Deliveries signed with the previous secret keep verifying until previousSecretExpiresAt. ${IDEMPOTENCY_DESCRIPTION}`,
		tags: ["Webhook endpoints"],
		params: ENDPOINT_PARAMS,
		responses: {
			200: { description: "The endpoint and its new one-time secret", body: ENDPOINT_WITH_SECRET },
		},
		problems: [...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS, "notFound"],
		security: requires("webhooks:write"),
	},
);

/** `DELETE /tenants/:tenantId/webhook-endpoints/:endpointId`: deletes the endpoint. */
export const WEBHOOK_ENDPOINTS_DELETE = defineOperation(
	"webhookEndpointsDelete",
	routes.webhookEndpointsDelete,
	{
		summary: "Delete a webhook endpoint",
		tags: ["Webhook endpoints"],
		params: ENDPOINT_PARAMS,
		responses: { 204: { description: "The endpoint is gone" } },
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("webhooks:write"),
	},
);

/** `GET /tenants/:tenantId/webhook-endpoints/:endpointId/deliveries`: a keyset page of one endpoint's deliveries, newest first. */
export const WEBHOOK_DELIVERIES_LIST = defineOperation(
	"webhookDeliveriesList",
	routes.webhookDeliveriesList,
	{
		summary: "List an endpoint's deliveries",
		tags: ["Webhook endpoints"],
		params: ENDPOINT_PARAMS,
		query: s.object({ ...PAGING_QUERY }),
		responses: {
			200: {
				description: "The page of deliveries",
				body: s.array(WEBHOOK_DELIVERY),
				headers: LINK_HEADER,
			},
		},
		problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS],
		security: requires("webhooks:write"),
	},
);

/** `POST .../deliveries/:deliveryId/replay`: enqueues a new delivery of the original's payload, with its own id. */
export const WEBHOOK_DELIVERIES_REPLAY = defineOperation(
	"webhookDeliveriesReplay",
	routes.webhookDeliveriesReplay,
	{
		summary: "Replay a webhook delivery",
		description: `The replay is a new delivery whose replayOf names the original. ${IDEMPOTENCY_DESCRIPTION}`,
		tags: ["Webhook endpoints"],
		params: s.object({ tenantId: s.string(), endpointId: s.string(), deliveryId: s.string() }),
		responses: { 201: { description: "The new pending delivery", body: WEBHOOK_DELIVERY } },
		problems: [...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS, "notFound"],
		security: requires("webhooks:write"),
	},
);

/** Every operation in this area, in route-map order, for the document to list. */
export const WEBHOOK_ENDPOINTS_OPERATIONS = [
	WEBHOOK_ENDPOINTS_REGISTER,
	WEBHOOK_ENDPOINTS_LIST,
	WEBHOOK_ENDPOINTS_READ,
	WEBHOOK_ENDPOINTS_UPDATE,
	WEBHOOK_ENDPOINTS_ROTATE_SECRET,
	WEBHOOK_ENDPOINTS_DELETE,
	WEBHOOK_DELIVERIES_LIST,
	WEBHOOK_DELIVERIES_REPLAY,
] as const;
