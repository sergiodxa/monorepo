/**
 * Schemas for the three forms the account area posts: the profile update, and the
 * intent-discriminated submissions of the sessions and grants pages. Every one of them
 * carries an identifier the browser chose, so validation here only confirms shape —
 * the controllers scope each mutation to the signed-in subject themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

/**
 * `avatar` must be an absolute URL: the value renders straight into an `<img src>`,
 * where the browser resolves a relative or `javascript:` value against this origin.
 */
export const UpdateProfileSchema = s.object({
	displayName: s.string().pipe(checks.minLength(1)),
	username: s.string().pipe(checks.minLength(1)),
	avatar: s.string().pipe(checks.url()),
});

/** A validated profile update. */
export type UpdateProfile = s.InferOutput<typeof UpdateProfileSchema>;

/**
 * Each discriminator passes its type argument explicitly to keep `literal` narrowed to
 * that value; left implicit, the inferred `"revoke"` widens to `string` and the parsed
 * union stops discriminating, leaving every branch holding every field.
 */
export const SessionsIntentSchema = s.variant("intent", {
	revoke: s.object({
		intent: s.literal<"revoke">("revoke"),
		/** The session row's id doubles as that session's refresh token, staying out of logs. */
		sessionId: s.string().pipe(checks.minLength(1)),
	}),
	"revoke-all": s.object({ intent: s.literal<"revoke-all">("revoke-all") }),
});

/** A validated sessions-page submission. */
export type SessionsIntent = s.InferOutput<typeof SessionsIntentSchema>;

/** What the grants page's single `POST` route was asked to do. */
export const GrantsIntentSchema = s.variant("intent", {
	revoke: s.object({
		intent: s.literal<"revoke">("revoke"),
		clientId: s.string().pipe(checks.minLength(1)),
	}),
});

/** A validated grants-page submission. */
export type GrantsIntent = s.InferOutput<typeof GrantsIntentSchema>;
