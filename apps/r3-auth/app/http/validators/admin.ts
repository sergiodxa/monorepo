/**
 * Schemas for every form and query string the admin area accepts: the client and
 * subject editors, the `intent` variants each page's single POST route discriminates
 * on, and the page number the two listings read. Administration is the one place that
 * can rewrite a relying party's redirect URI, so nothing reaches a model unvalidated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

/** Longest description a client may carry, matching what the detail page can show. */
const DESCRIPTION_MAX_LENGTH = 280;

/**
 * A URL field that is allowed to be left empty.
 *
 * An empty text input posts `""`, which is not a URL and must not be a validation
 * failure for an optional field — it is how an administrator clears the value, so it
 * normalizes to `null` rather than being rejected or stored as an empty string.
 */
function optionalUrl() {
	return s.optional(
		s.union([s.literal<"">(""), s.string().pipe(checks.url())]).transform((value) => {
			return value === "" || value === undefined ? null : value;
		}),
	);
}

/**
 * A checkbox as a form posts it: present with a value when ticked, absent otherwise.
 *
 * The browser sends nothing at all for an unticked box, so the absence — not a `"off"`
 * value — is what has to mean `false`.
 */
function checkbox() {
	return s.optional(s.string()).transform((value) => value === "on");
}

/**
 * A checkbox whose stored form is the text `"true"` / `"false"`.
 *
 * The two `*_session_required` columns are `text`, not booleans, so a round trip
 * through this form has to land back on those exact strings or a client's back-channel
 * logout silently stops carrying its `sid`.
 */
function textBooleanCheckbox() {
	return s.optional(s.string()).transform((value) => (value === "on" ? "true" : "false"));
}

/** Fields shared by registering a client and editing one. */
const CLIENT_FIELDS = {
	name: s.string().pipe(checks.minLength(1)),
	description: s.optional(
		s
			.string()
			.pipe(checks.maxLength(DESCRIPTION_MAX_LENGTH))
			.transform((value) => {
				return value === "" ? null : value;
			}),
	),
	logoUrl: optionalUrl(),
	redirectUri: s.string().pipe(checks.url()),
	logoutUri: s.string().pipe(checks.url()),
};

/** A new client registration, as the create form posts it. */
export const CreateClientSchema = s.object(CLIENT_FIELDS);

/** A validated client registration. */
export type CreateClientForm = s.InferOutput<typeof CreateClientSchema>;

/**
 * A client edit, as the edit form posts it.
 *
 * The secret is never an input: `regenerateSecret` rotates it and the new value is
 * revealed once, which is the only way it can change.
 */
export const UpdateClientSchema = s.object({
	...CLIENT_FIELDS,
	backchannelLogoutUri: optionalUrl(),
	backchannelLogoutSessionRequired: textBooleanCheckbox(),
	frontchannelLogoutUri: optionalUrl(),
	frontchannelLogoutSessionRequired: textBooleanCheckbox(),
	regenerateSecret: checkbox(),
});

/** A validated client edit. */
export type UpdateClientForm = s.InferOutput<typeof UpdateClientSchema>;

/**
 * A subject edit, as the edit form posts it. The email address is deliberately absent:
 * it is the identity provider linking a social identity to an account, so changing it
 * from an admin screen would silently re-point that link.
 */
export const UpdateSubjectSchema = s.object({
	displayName: s.string().pipe(checks.minLength(1)),
	username: s.string().pipe(checks.minLength(1)),
	avatar: s.string().pipe(checks.url()),
	role: s.enum_(["user", "admin"] as const),
	emailVerified: checkbox(),
});

/** A validated subject edit. */
export type UpdateSubjectForm = s.InferOutput<typeof UpdateSubjectSchema>;

/**
 * The client list's only intent. Declared as a variant rather than a bare object so a
 * post naming any other intent fails validation instead of falling through to a
 * deletion, which is the failure mode worth designing against on this page.
 */
export const ClientsIntentSchema = s.variant("intent", {
	delete: s.object({
		intent: s.literal<"delete">("delete"),
		clientId: s.string().pipe(checks.minLength(1)),
	}),
});

/** A validated client-list intent. */
export type ClientsIntent = s.InferOutput<typeof ClientsIntentSchema>;

/** The client detail page's only intent; the client id comes from the URL, not the form. */
export const ClientIntentSchema = s.variant("intent", {
	delete: s.object({ intent: s.literal<"delete">("delete") }),
});

/** A validated client detail intent. */
export type ClientIntent = s.InferOutput<typeof ClientIntentSchema>;

/**
 * The subject detail page's three intents.
 *
 * `revoke-session` carries the session id, which **is** that session's refresh token:
 * it is accepted here only as an opaque value to delete by, and never logged or echoed.
 */
export const SubjectIntentSchema = s.variant("intent", {
	delete: s.object({ intent: s.literal<"delete">("delete") }),
	"revoke-session": s.object({
		intent: s.literal<"revoke-session">("revoke-session"),
		sessionId: s.string().pipe(checks.minLength(1)),
	}),
	"revoke-all-sessions": s.object({
		intent: s.literal<"revoke-all-sessions">("revoke-all-sessions"),
	}),
});

/** A validated subject detail intent. */
export type SubjectIntent = s.InferOutput<typeof SubjectIntentSchema>;
