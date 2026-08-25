/**
 * Schema for the RP-initiated logout query string. Every parameter OpenID Connect
 * RP-Initiated Logout 1.0 defines is optional, so this schema only shapes what
 * arrives; deciding which combinations are usable belongs to the controller and
 * the engine, which can turn any of them into a redirect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/** Shape of the ids this server issues, so a malformed `client_id` never reaches a query. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A logout request as it arrives on the query string.
 *
 * `logout_hint` and `ui_locales` are accepted so every request the specification allows
 * stays valid, though this server serves one account and one language per session.
 */
export const LogoutQuerySchema = s.object({
	id_token_hint: s.optional(s.string()),
	post_logout_redirect_uri: s.optional(s.string()),
	client_id: s.optional(
		s.string().refine((value) => UUID_PATTERN.test(value), "Invalid client_id"),
	),
	logout_hint: s.optional(s.string()),
	ui_locales: s.optional(s.string()),
	state: s.optional(s.string()),
});

/** A validated logout request. */
export type LogoutQuery = s.InferOutput<typeof LogoutQuerySchema>;
