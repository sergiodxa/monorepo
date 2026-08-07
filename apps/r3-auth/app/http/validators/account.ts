/**
 * Schemas for the three forms the account area posts: the profile update, and the
 * intent-discriminated submissions of the sessions and grants pages. Every one of them
 * carries an identifier the browser chose, so nothing here is trusted beyond its shape
 * — the controllers scope each mutation to the signed-in subject themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

/**
 * The profile edit form.
 *
 * `avatar` must be an absolute URL because the value is rendered straight into an
 * `<img src>`; a relative or `javascript:` value would otherwise be resolved against
 * this origin by the browser.
 */
export const UpdateProfileSchema = s.object({
	displayName: s.string().pipe(checks.minLength(1)),
	username: s.string().pipe(checks.minLength(1)),
	avatar: s.string().pipe(checks.url()),
});

/** A validated profile update. */
export type UpdateProfile = s.InferOutput<typeof UpdateProfileSchema>;

/**
 * What the sessions page's single `POST` route was asked to do.
 *
 * Each discriminator passes its type argument explicitly: `literal`'s parameter is not
 * declared `const`, so an inferred `"revoke"` widens to `string` and the parsed union
 * stops discriminating, leaving every branch holding every field.
 */
export const SessionsIntentSchema = s.variant("intent", {
	revoke: s.object({
		intent: s.literal<"revoke">("revoke"),
		/** The session row's id. It is also the refresh token, so it is never logged. */
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
