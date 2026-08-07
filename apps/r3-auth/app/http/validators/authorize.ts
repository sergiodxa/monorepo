/**
 * Schemas for the authorization endpoint: the query string of an authorization
 * request, and the credential sign-in form posted back to the same URL. Everything a
 * relying party or a browser sends is validated here before any of it reaches the
 * engine.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

import type { SupportedScope } from "~/app/config";
import type { PromptValue } from "~/app/http/middleware/session";

import { SCOPES_SUPPORTED } from "~/app/config";

/** `prompt` values this server understands; anything else in the list is ignored. */
const PROMPT_VALUES: readonly PromptValue[] = [
	"none",
	"login",
	"consent",
	"select_account",
	"create",
];

/** Shape of the ids this server issues, so a malformed `client_id` never reaches a query. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimum password length accepted at registration and sign-in. */
const MINIMUM_PASSWORD_LENGTH = 8;

/**
 * An authorization request as it arrives on the query string.
 *
 * Unsupported scopes and unsupported prompt values are filtered out rather than
 * rejected, per OIDC Core: a client asking for something this server does not offer
 * gets what it does offer, not an error page.
 *
 * `code_challenge_method` is only shaped here, not constrained: an unknown method has
 * to become an `invalid_request` sent back to the client's redirect URI, and a schema
 * failure at this point cannot tell the difference between that and a request carrying
 * no OAuth parameters at all.
 */
export const AuthorizeQuerySchema = s.object({
	response_type: s.literal("code"),
	client_id: s.string().refine((value) => UUID_PATTERN.test(value), "Invalid client_id"),
	redirect_uri: s.string().pipe(checks.url()),
	state: s.string(),
	scope: s.optional(s.string()).transform((value) => {
		if (!value) return ["openid"] as SupportedScope[];
		return value
			.split(" ")
			.filter((scope): scope is SupportedScope =>
				(SCOPES_SUPPORTED as readonly string[]).includes(scope),
			);
	}),
	nonce: s.optional(s.string()),
	response_mode: s.defaulted(s.enum_(["query", "fragment", "form_post"] as const), "query"),
	prompt: s.optional(s.string()).transform((value) => {
		if (!value) return undefined;
		let values = value
			.split(" ")
			.filter((entry): entry is PromptValue => PROMPT_VALUES.includes(entry as PromptValue));
		return values.length > 0 ? values : undefined;
	}),
	provider: s.optional(s.string()),
	code_challenge: s.optional(s.string()),
	code_challenge_method: s.optional(s.string()),
});

/** A validated authorization request. */
export type AuthorizeQuery = s.InferOutput<typeof AuthorizeQuerySchema>;

/**
 * The credential sign-in form. Registration and sign-in post the same fields: the
 * engine decides which one is happening from whether the address is already known.
 */
export const AuthorizeFormSchema = s.object({
	email: s.string().pipe(checks.email()),
	password: s.string().pipe(checks.minLength(MINIMUM_PASSWORD_LENGTH)),
	name: s.string().pipe(checks.minLength(1)),
	username: s.string().pipe(checks.minLength(1)),
});

/** A validated credential sign-in submission. */
export type AuthorizeForm = s.InferOutput<typeof AuthorizeFormSchema>;
