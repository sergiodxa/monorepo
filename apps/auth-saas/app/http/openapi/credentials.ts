/**
 * The management API's operations for Passkeys, passwords, second factors and sessions: the schemas each route's
 * handler parses with and the OpenAPI document publishes, so the two cannot drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import {
	AUTH_PROBLEMS,
	LINK_HEADER,
	mergePatchBody,
	PAGING_PROBLEMS,
	PAGING_QUERY,
	requires,
	UNSUPPORTED_MEDIA_TYPE,
} from "~/app/http/openapi/shared";
import routes from "~/routes/management";

/**
 * A passkey enrolled under a subject, without any credential material; timestamps are
 * epoch milliseconds and `lastUsedAt` is `null` until it first signs in.
 */
export const PASSKEY = s
	.object({
		credentialId: s.string(),
		label: s.string(),
		transports: s.array(s.string()),
		syncable: s.boolean(),
		backedUp: s.boolean(),
		createdAt: s.integer(),
		lastUsedAt: s.nullable(s.integer()),
	})
	.meta({ id: "Passkey" });

/**
 * A subject's live session; timestamps are epoch milliseconds, and the request metadata
 * is `null` where it was not captured. A management caller holds no session, so
 * `isCurrent` is always `false` here.
 */
export const SESSION = s
	.object({
		id: s.string(),
		createdAt: s.integer(),
		lastSeenAt: s.integer(),
		amr: s.array(s.string()),
		ip: s.nullable(s.string()),
		userAgent: s.nullable(s.string()),
		country: s.nullable(s.string()),
		region: s.nullable(s.string()),
		city: s.nullable(s.string()),
		isCurrent: s.boolean(),
	})
	.meta({ id: "Session" });

/** The audit reason every administrative credential reset or revocation records: the body, or a `DELETE`'s query. */
const REASON = s.object({ reason: s.string() });

/** `GET /tenants/:tenantId/subjects/:subjectId/passkeys`: every passkey the subject holds, newest first. */
export const PASSKEYS_LIST = defineOperation("passkeysList", routes.passkeysList, {
	summary: "List a subject's passkeys",
	tags: ["Credentials"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	responses: { 200: { description: "Every passkey the subject holds", body: s.array(PASSKEY) } },
	problems: [...AUTH_PROBLEMS],
	security: requires("subjects:write"),
});

/** The `passkeysRename` merge patch; a label is the only member a passkey lets a caller write. */
export const PASSKEY_PATCH = s.object({ label: s.string() });

/** `PATCH /tenants/:tenantId/subjects/:subjectId/passkeys/:credentialId`: renames one passkey. */
export const PASSKEYS_RENAME = defineOperation("passkeysRename", routes.passkeysRename, {
	summary: "Rename a passkey",
	tags: ["Credentials"],
	params: s.object({ tenantId: s.string(), subjectId: s.string(), credentialId: s.string() }),
	body: mergePatchBody(PASSKEY_PATCH),
	responses: {
		204: { description: "The passkey was renamed" },
		415: UNSUPPORTED_MEDIA_TYPE,
	},
	problems: [...AUTH_PROBLEMS, "validationFailed", "notFound"],
	security: requires("subjects:write"),
});

/** `DELETE /tenants/:tenantId/subjects/:subjectId/passkeys/:credentialId`: removes a passkey, never the last way in. */
export const PASSKEYS_REVOKE = defineOperation("passkeysRevoke", routes.passkeysRevoke, {
	summary: "Revoke a passkey",
	tags: ["Credentials"],
	params: s.object({ tenantId: s.string(), subjectId: s.string(), credentialId: s.string() }),
	responses: { 204: { description: "The passkey was removed" } },
	problems: [...AUTH_PROBLEMS, "notFound", "lastCredential"],
	security: requires("subjects:write"),
});

/** `POST .../subjects/:subjectId/password/force-reset`: marks the password as owing a change and ends every session. */
export const PASSWORD_FORCE_RESET = defineOperation(
	"passwordForceReset",
	routes.passwordForceReset,
	{
		summary: "Force a password reset",
		tags: ["Credentials"],
		params: s.object({ tenantId: s.string(), subjectId: s.string() }),
		body: REASON,
		responses: {
			200: {
				description: "The password now owing a change, and the recorded reason",
				body: s.object({ passwordId: s.string(), reason: s.string() }),
			},
		},
		problems: [...AUTH_PROBLEMS, "validationFailed", "notFound", "noPassword"],
		security: requires("subjects:write"),
	},
);

/** `POST .../subjects/:subjectId/second-factor/reset`: strips the TOTP state and requires a fresh enrolment. */
export const SECOND_FACTOR_RESET = defineOperation("secondFactorReset", routes.secondFactorReset, {
	summary: "Reset a subject's second factor",
	tags: ["Credentials"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	body: REASON,
	responses: {
		200: {
			description: "The address the subject is notified at, or null when it has none",
			body: s.object({ notifyAddress: s.nullable(s.string()) }),
		},
	},
	problems: [...AUTH_PROBLEMS, "validationFailed", "notFound"],
	security: requires("subjects:write"),
});

/** `POST .../second-factor/trusted-devices/:deviceId/revoke`: makes one remembered browser prove the factor again. */
export const SECOND_FACTOR_TRUSTED_DEVICES_REVOKE = defineOperation(
	"secondFactorTrustedDevicesRevoke",
	routes.secondFactorTrustedDevicesRevoke,
	{
		summary: "Revoke a trusted device",
		tags: ["Credentials"],
		params: s.object({ tenantId: s.string(), subjectId: s.string(), deviceId: s.string() }),
		responses: { 204: { description: "The device was revoked" } },
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("subjects:write"),
	},
);

/** `GET /tenants/:tenantId/subjects/:subjectId/sessions`: a keyset page of live sessions, newest first. */
export const SESSIONS_LIST = defineOperation("sessionsList", routes.sessionsList, {
	summary: "List a subject's sessions",
	tags: ["Credentials"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	query: s.object({ ...PAGING_QUERY }),
	responses: {
		200: { description: "The page of sessions", body: s.array(SESSION), headers: LINK_HEADER },
	},
	problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS],
	security: requires("sessions:write"),
});

/** `DELETE .../subjects/:subjectId/sessions/:sessionId?reason=`: ends one session, recording why. */
export const SESSIONS_REVOKE = defineOperation("sessionsRevoke", routes.sessionsRevoke, {
	summary: "Revoke a session",
	tags: ["Credentials"],
	params: s.object({ tenantId: s.string(), subjectId: s.string(), sessionId: s.string() }),
	query: REASON,
	responses: { 204: { description: "The session was revoked" } },
	problems: [...AUTH_PROBLEMS, "validationFailed", "notFound"],
	security: requires("sessions:write"),
});

/** `POST .../subjects/:subjectId/sessions/revoke-all`: ends every live session the subject holds. */
export const SESSIONS_REVOKE_ALL = defineOperation("sessionsRevokeAll", routes.sessionsRevokeAll, {
	summary: "Revoke every session",
	tags: ["Credentials"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	body: REASON,
	responses: {
		200: {
			description: "How many sessions were revoked",
			body: s.object({ revoked: s.integer() }),
		},
	},
	problems: [...AUTH_PROBLEMS, "validationFailed"],
	security: requires("sessions:write"),
});

/** Every operation in this area, in route-map order, for the document to list. */
export const CREDENTIALS_OPERATIONS = [
	PASSKEYS_LIST,
	PASSKEYS_RENAME,
	PASSKEYS_REVOKE,
	PASSWORD_FORCE_RESET,
	SECOND_FACTOR_RESET,
	SECOND_FACTOR_TRUSTED_DEVICES_REVOKE,
	SESSIONS_LIST,
	SESSIONS_REVOKE,
	SESSIONS_REVOKE_ALL,
] as const;
