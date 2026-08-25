/**
 * Schemas for the three OAuth machine endpoints: the token endpoint's grant variants,
 * and the token argument revocation and introspection share. Client credentials are
 * optional in every variant because a request may present them in the `Authorization`
 * header instead of the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

/**
 * A token request, discriminated on `grant_type`.
 *
 * Each discriminator passes its type argument explicitly, since `literal`'s inferred
 * type would otherwise widen to `string` and leave every branch holding every field.
 */
export const TokenRequestSchema = s.variant("grant_type", {
	authorization_code: s.object({
		grant_type: s.literal<"authorization_code">("authorization_code"),
		code: s.string(),
		code_verifier: s.optional(s.string()),
		redirect_uri: s.string().pipe(checks.url()),
		client_id: s.optional(s.string()),
		client_secret: s.optional(s.string()),
	}),
	refresh_token: s.object({
		grant_type: s.literal<"refresh_token">("refresh_token"),
		refresh_token: s.string(),
		client_id: s.optional(s.string()),
		client_secret: s.optional(s.string()),
	}),
	client_credentials: s.object({
		grant_type: s.literal<"client_credentials">("client_credentials"),
		client_id: s.optional(s.string()),
		client_secret: s.optional(s.string()),
		/**
		 * RFC 8707 allows `resource` more than once, and a form body carrying it twice
		 * parses as an array — normalized to one here so the engine always reads a list.
		 */
		resource: s.optional(s.union([s.string(), s.array(s.string())])).transform((value) => {
			if (Array.isArray(value)) return value;
			return value ? [value] : [];
		}),
	}),
});

/** A validated token request. */
export type TokenRequest = s.InferOutput<typeof TokenRequestSchema>;

/** The body revocation (RFC 7009) and introspection (RFC 7662) both take. */
export const TokenIntrospectionSchema = s.object({
	token: s.string(),
	token_type_hint: s.optional(s.enum_(["access_token", "refresh_token"] as const)),
});

/** A validated revocation or introspection request. */
export type TokenIntrospection = s.InferOutput<typeof TokenIntrospectionSchema>;
