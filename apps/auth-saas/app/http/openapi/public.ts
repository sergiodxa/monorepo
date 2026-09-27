/**
 * The management API's operations for the token endpoint and invitation acceptance, the two
 * routes that take no management token: the schemas each route's handler parses with and the
 * OpenAPI document publishes, so the two cannot drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import { PLAIN_PROBLEM } from "~/app/http/openapi/shared";
import routes from "~/routes/management";

/** An RFC 6749 §5.2 error body: the token endpoint answers these, never problem documents. */
export const OAUTH_TOKEN_ERROR = s
	.object({ error: s.string(), error_description: s.string() })
	.meta({ id: "OAuthTokenError" });

/** A token endpoint refusal; the status tells a caller whether to fix the request or the credentials. */
const TOKEN_ERROR_RESPONSE = {
	description: "The grant was refused",
	body: OAUTH_TOKEN_ERROR,
} as const;

/** `POST /oauth/token`: a client-credentials grant minting a token bound to the client's tenant. */
export const TOKEN = defineOperation("token", routes.token, {
	summary: "Get an access token",
	description:
		"Exchanges a management client's id and secret, as HTTP Basic or form fields, for a short-lived access token. Only client_credentials is supported.",
	tags: ["OAuth"],
	body: {
		"application/x-www-form-urlencoded": s.object({
			grant_type: s.literal("client_credentials"),
			client_id: s.optional(s.string()),
			client_secret: s.optional(s.string()),
			scope: s.optional(s.string().meta({ description: "Space-separated scopes" })),
			resource: s.optional(
				s
					.union([s.string(), s.array(s.string())])
					.meta({ description: "RFC 8707 resource indicators" }),
			),
		}),
	},
	responses: {
		200: {
			description: "The access token",
			body: s.object({
				access_token: s.string(),
				token_type: s.literal("Bearer"),
				expires_in: s.integer().meta({ description: "Seconds until the token expires" }),
				scope: s.string(),
			}),
			headers: {
				"Cache-Control": { schema: s.string(), description: "no-store", required: true },
			},
		},
		400: {
			description:
				"The grant was refused, or X-API-Version names a version this API does not publish",
			body: { "application/json": OAUTH_TOKEN_ERROR, "application/problem+json": PLAIN_PROBLEM },
		},
		401: {
			...TOKEN_ERROR_RESPONSE,
			description: "The client failed to authenticate",
			headers: {
				"WWW-Authenticate": { schema: s.string(), description: "Basic", required: true },
			},
		},
		500: { ...TOKEN_ERROR_RESPONSE, description: "The token could not be issued" },
	},
	security: [],
});

/** `POST /invitations/accept`: the emailed token is the whole credential, spendable once. */
export const INVITATIONS_ACCEPT = defineOperation("invitationsAccept", routes.invitationsAccept, {
	summary: "Accept a member invitation",
	description:
		"Grants the invited role and signs the invited address into the platform dashboard. An unknown, spent or expired token answers the same refusal.",
	tags: ["Members"],
	body: s.object({ token: s.string() }),
	responses: {
		200: {
			description: "The membership granted, with a dashboard session cookie",
			body: s.object({
				tenantId: s.string(),
				role: s.enum_(["owner", "admin", "member"] as const),
			}),
			headers: {
				"Set-Cookie": {
					schema: s.string(),
					description: "The platform dashboard session",
					required: true,
				},
			},
		},
	},
	problems: ["validationFailed", "invalidTicket", "unsupportedApiVersion"],
	security: [],
});

/** Every operation in this area, in route-map order, for the document to list. */
export const PUBLIC_OPERATIONS = [TOKEN, INVITATIONS_ACCEPT] as const;
