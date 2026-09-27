/**
 * The management API's operations for Subjects, their identifiers, and subject import and export runs: the schemas each route's
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

/** The media type an import's source file and every run's downloadable output travel as. */
const NDJSON = "application/x-ndjson";

/** A run's lifecycle; only a `completed` run offers its output for download. */
const RUN_STATUS = s.enum_(["queued", "running", "completed", "failed"] as const);

/** The standard OIDC profile claims, in the API's own casing; `null` means the subject holds none. */
export const SUBJECT_PROFILE_INPUT = s
	.object({
		name: s.optional(s.nullable(s.string())),
		givenName: s.optional(s.nullable(s.string())),
		familyName: s.optional(s.nullable(s.string())),
		nickname: s.optional(s.nullable(s.string())),
		preferredUsername: s.optional(s.nullable(s.string())),
		picture: s.optional(s.nullable(s.string())),
		locale: s.optional(s.nullable(s.string())),
		zoneinfo: s.optional(s.nullable(s.string())),
	})
	.meta({ id: "SubjectProfileInput" });

/** A declared attribute's value, kept flat so it serializes into a token claim as is. */
export const ATTRIBUTE_VALUE = s
	.nullable(s.union([s.string(), s.number(), s.boolean()]))
	.meta({ id: "AttributeValue" });

/** One identifier with its verification state; `verifiedAt` is epoch milliseconds, `null` until verified. */
export const SUBJECT_IDENTIFIER = s
	.object({
		kind: s.enum_(["email", "username"] as const),
		value: s.string(),
		verified: s.boolean(),
		verifiedAt: s.nullable(s.integer()),
		isPrimary: s.boolean(),
	})
	.meta({ id: "SubjectIdentifier" });

/** One subject as a list row shows it: only its primary identifiers, timestamps in epoch milliseconds. */
export const SUBJECT_SUMMARY = s
	.object({
		id: s.string(),
		status: s.enum_(["active", "blocked"] as const),
		primaryIdentifiers: s.array(SUBJECT_IDENTIFIER),
		createdAt: s.integer(),
		updatedAt: s.integer(),
	})
	.meta({ id: "SubjectSummary" });

/** Everything an administrator sees of one subject, internal attributes included. */
export const SUBJECT = s
	.object({
		profile: s.object({
			id: s.string(),
			status: s.enum_(["active", "blocked"] as const),
			name: s.nullable(s.string()),
			givenName: s.nullable(s.string()),
			familyName: s.nullable(s.string()),
			nickname: s.nullable(s.string()),
			preferredUsername: s.nullable(s.string()),
			picture: s.nullable(s.string()),
			locale: s.nullable(s.string()),
			zoneinfo: s.nullable(s.string()),
		}),
		identifiers: s.array(SUBJECT_IDENTIFIER),
		attributes: s.record(s.string(), ATTRIBUTE_VALUE),
		credentials: s.array(s.any()),
		identities: s.array(
			s.object({
				connectionSlug: s.string(),
				providerEmail: s.nullable(s.string()),
				linkedBy: s.enum_(["automatic", "subject", "admin", "jit"] as const),
				linkedAt: s.integer(),
				lastSignInAt: s.nullable(s.integer()),
			}),
		),
		totpFactor: s.object({
			label: s.nullable(s.string()),
			lastUsedAt: s.nullable(s.integer()),
		}),
		recoveryCodesRemaining: s.integer(),
		trustedDevices: s.array(
			s.object({
				id: s.string(),
				createdAt: s.integer(),
				expiresAt: s.integer(),
				ip: s.nullable(s.string()),
				userAgent: s.nullable(s.string()),
			}),
		),
	})
	.meta({ id: "Subject" });

/** `POST /tenants/:tenantId/subjects`: a new subject with its identifiers, profile and attributes. */
export const SUBJECTS_CREATE = defineOperation("subjectsCreate", routes.subjectsCreate, {
	summary: "Create a subject",
	description: `Identifiers are written unverified. ${IDEMPOTENCY_DESCRIPTION}`,
	tags: ["Subjects"],
	params: s.object({ tenantId: s.string() }),
	body: s.object({
		identifiers: s.optional(
			s.array(s.object({ kind: s.enum_(["email", "username"] as const), value: s.string() })),
		),
		profile: s.optional(SUBJECT_PROFILE_INPUT),
		attributes: s.optional(s.record(s.string(), s.any())),
	}),
	responses: {
		201: {
			description: "The subject was created",
			body: s.object({ subjectId: s.string(), identifiers: s.array(SUBJECT_IDENTIFIER) }),
		},
	},
	problems: [
		...AUTH_PROBLEMS,
		...IDEMPOTENCY_PROBLEMS,
		"validationFailed",
		"invalidIdentifier",
		"identifierTaken",
		"duplicateUsername",
		"unknownAttribute",
	],
	security: requires("subjects:write"),
});

/** `GET /tenants/:tenantId/subjects`: a keyset page of the tenant's subjects, newest first. */
export const SUBJECTS_LIST = defineOperation("subjectsList", routes.subjectsList, {
	summary: "List subjects",
	description:
		"A keyset page of subjects, newest first; an unrecognized status lists every subject.",
	tags: ["Subjects"],
	params: s.object({ tenantId: s.string() }),
	query: s.object({
		status: s.optional(s.enum_(["active", "blocked"] as const)),
		...PAGING_QUERY,
	}),
	responses: {
		200: {
			description: "The page of subjects",
			body: s.array(SUBJECT_SUMMARY),
			headers: LINK_HEADER,
		},
	},
	problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS],
	security: requires("subjects:read"),
});

/** `GET /tenants/:tenantId/subjects/:subjectId`: one subject's full account view. */
export const SUBJECTS_READ = defineOperation("subjectsRead", routes.subjectsRead, {
	summary: "Read a subject",
	tags: ["Subjects"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	responses: { 200: { description: "The subject", body: SUBJECT } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("subjects:read"),
});

/**
 * `PATCH /tenants/:tenantId/subjects/:subjectId`: a merge patch over the profile and
 * attributes; a `null` member clears that claim or attribute.
 */
export const SUBJECTS_UPDATE = defineOperation("subjectsUpdate", routes.subjectsUpdate, {
	summary: "Update a subject",
	description: "An RFC 7396 merge patch over profile and attributes; null clears a member.",
	tags: ["Subjects"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	body: mergePatchBody(
		s.object({
			profile: s.optional(s.nullable(SUBJECT_PROFILE_INPUT)),
			attributes: s.optional(s.nullable(s.record(s.string(), ATTRIBUTE_VALUE))),
		}),
	),
	responses: {
		204: { description: "The subject was updated" },
		415: UNSUPPORTED_MEDIA_TYPE,
	},
	problems: [
		...AUTH_PROBLEMS,
		"validationFailed",
		"notFound",
		"unknownAttribute",
		"attributeNotWritable",
	],
	security: requires("subjects:write"),
});

/** `POST /tenants/:tenantId/subjects/:subjectId/block`: stops the subject from signing in. */
export const SUBJECTS_BLOCK = defineOperation("subjectsBlock", routes.subjectsBlock, {
	summary: "Block a subject",
	tags: ["Subjects"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	body: s.object({ reason: s.string() }),
	responses: { 204: { description: "The subject was blocked" } },
	problems: [...AUTH_PROBLEMS, "validationFailed", "notFound"],
	security: requires("subjects:write"),
});

/** `POST /tenants/:tenantId/subjects/:subjectId/unblock`: lets a blocked subject sign in again. */
export const SUBJECTS_UNBLOCK = defineOperation("subjectsUnblock", routes.subjectsUnblock, {
	summary: "Unblock a subject",
	tags: ["Subjects"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	responses: { 204: { description: "The subject was unblocked" } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("subjects:write"),
});

/** `DELETE /tenants/:tenantId/subjects/:subjectId`: removes the subject and everything it holds. */
export const SUBJECTS_DELETE = defineOperation("subjectsDelete", routes.subjectsDelete, {
	summary: "Delete a subject",
	tags: ["Subjects"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	responses: { 204: { description: "The subject was deleted" } },
	problems: [...AUTH_PROBLEMS, "notFound"],
	security: requires("subjects:write"),
});

/**
 * `POST /tenants/:tenantId/subjects/:subjectId/identifiers`: claims an identifier. An email
 * answers with the verification ticket the caller delivers; a username is usable at once.
 */
export const SUBJECT_IDENTIFIERS_ADD = defineOperation(
	"subjectIdentifiersAdd",
	routes.subjectIdentifiersAdd,
	{
		summary: "Add an identifier to a subject",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string(), subjectId: s.string() }),
		body: s.object({ kind: s.enum_(["email", "username"] as const), value: s.string() }),
		responses: {
			201: {
				description: "The identifier was claimed; an email carries its verification ticket",
				body: s.union([
					s.object({
						identifierId: s.string(),
						kind: s.literal("email"),
						value: s.string(),
						ticket: s.string(),
						ticketExpiresAt: s.integer(),
					}),
					s.object({ identifierId: s.string(), kind: s.literal("username"), value: s.string() }),
				]),
			},
		},
		problems: [
			...AUTH_PROBLEMS,
			"validationFailed",
			"notFound",
			"invalidIdentifier",
			"identifierTaken",
			"usernameAlreadySet",
		],
		security: requires("subjects:write"),
	},
);

/** `POST /tenants/:tenantId/subjects/identifiers/verify`: spends a verification ticket, which alone names its subject. */
export const SUBJECT_IDENTIFIERS_VERIFY = defineOperation(
	"subjectIdentifiersVerify",
	routes.subjectIdentifiersVerify,
	{
		summary: "Verify an identifier",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string() }),
		body: s.object({ ticket: s.string() }),
		responses: {
			200: {
				description: "The identifier is verified; promotedPrimary tells whether it became primary",
				body: s.object({ subjectId: s.string(), promotedPrimary: s.boolean() }),
			},
		},
		problems: [...AUTH_PROBLEMS, "validationFailed", "expiredTicket", "invalidVerificationTicket"],
		security: requires("subjects:write"),
	},
);

/** `POST /tenants/:tenantId/subjects/:subjectId/identifiers/primary`: makes a verified identifier primary. */
export const SUBJECT_IDENTIFIERS_SET_PRIMARY = defineOperation(
	"subjectIdentifiersSetPrimary",
	routes.subjectIdentifiersSetPrimary,
	{
		summary: "Set a subject's primary identifier",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string(), subjectId: s.string() }),
		body: s.object({ value: s.string() }),
		responses: { 204: { description: "The identifier is now primary" } },
		problems: [...AUTH_PROBLEMS, "validationFailed", "notFound", "unverified"],
		security: requires("subjects:write"),
	},
);

/**
 * `DELETE /tenants/:tenantId/subjects/:subjectId/identifiers?value=`: the value travels in
 * the query string because a path segment stops at the `.` every email carries.
 */
export const SUBJECT_IDENTIFIERS_REMOVE = defineOperation(
	"subjectIdentifiersRemove",
	routes.subjectIdentifiersRemove,
	{
		summary: "Remove an identifier from a subject",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string(), subjectId: s.string() }),
		query: s.object({ value: s.string() }),
		responses: {
			200: {
				description:
					"The identifier was removed; notify lists every verified address to announce it to",
				body: s.object({ promotedPrimary: s.nullable(s.string()), notify: s.array(s.string()) }),
			},
		},
		problems: [...AUTH_PROBLEMS, "validationFailed", "notFound", "lastVerifiedIdentifier"],
		security: requires("subjects:write"),
	},
);

/**
 * `POST /tenants/:tenantId/subjects/import?mode=`: queues an import of an NDJSON file, one
 * subject per line; `validate` reports what `apply` would do without writing.
 */
export const SUBJECTS_IMPORT_BEGIN = defineOperation(
	"subjectsImportBegin",
	routes.subjectsImportBegin,
	{
		summary: "Begin a subject import",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string() }),
		query: s.object({ mode: s.enum_(["validate", "apply"] as const) }),
		body: { [NDJSON]: s.string() },
		responses: {
			201: {
				description: "The run was queued",
				body: s.object({ id: s.string(), status: RUN_STATUS, total: s.nullable(s.integer()) }),
			},
		},
		problems: [...AUTH_PROBLEMS, "validationFailed"],
		security: requires("subjects:write"),
	},
);

/** `GET /tenants/:tenantId/subjects/import/:runId`: a run's progress, and its report link once completed. */
export const SUBJECTS_IMPORT_STATUS = defineOperation(
	"subjectsImportStatus",
	routes.subjectsImportStatus,
	{
		summary: "Read a subject import run",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string(), runId: s.string() }),
		responses: {
			200: {
				description: "The run; reportDownloadUrl is a single-use link present once it completes",
				body: s.object({
					id: s.string(),
					mode: s.enum_(["validate", "apply"] as const),
					status: RUN_STATUS,
					total: s.nullable(s.integer()),
					processed: s.integer(),
					created: s.integer(),
					updated: s.integer(),
					failed: s.integer(),
					reportDownloadUrl: s.optional(s.string()),
				}),
			},
		},
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("subjects:read"),
	},
);

/** `GET /tenants/:tenantId/subjects/import/:runId/download?ticket=`: the run's report; the ticket is the whole credential. */
export const SUBJECTS_IMPORT_DOWNLOAD = defineOperation(
	"subjectsImportDownload",
	routes.subjectsImportDownload,
	{
		summary: "Download a subject import report",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string(), runId: s.string() }),
		query: s.object({ ticket: s.string() }),
		responses: {
			200: {
				description: "The report, one NDJSON line per source row",
				body: { [NDJSON]: s.string() },
			},
		},
		problems: ["invalidTicket", "notFound"],
		security: [],
	},
);

/** `POST /tenants/:tenantId/subjects/export`: queues an export; credentials need `export:credentials` too. */
export const SUBJECTS_EXPORT_BEGIN = defineOperation(
	"subjectsExportBegin",
	routes.subjectsExportBegin,
	{
		summary: "Begin a subject export",
		description: `Including password hashes requires the export:credentials scope. ${IDEMPOTENCY_DESCRIPTION}`,
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string() }),
		body: s.optional(s.object({ includeCredentials: s.optional(s.boolean()) })),
		responses: {
			201: {
				description: "The run was queued",
				body: s.object({ id: s.string(), status: RUN_STATUS }),
			},
		},
		problems: [...AUTH_PROBLEMS, ...IDEMPOTENCY_PROBLEMS, "validationFailed"],
		security: requires("export:read"),
	},
);

/** `GET /tenants/:tenantId/subjects/export/:runId`: a run's progress, and its download link once completed. */
export const SUBJECTS_EXPORT_STATUS = defineOperation(
	"subjectsExportStatus",
	routes.subjectsExportStatus,
	{
		summary: "Read a subject export run",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string(), runId: s.string() }),
		responses: {
			200: {
				description:
					"The run; exportDownloadUrl is a single-use link present once it completes, and for a credentials export only to a caller holding export:credentials",
				body: s.object({
					id: s.string(),
					includeCredentials: s.boolean(),
					status: RUN_STATUS,
					total: s.nullable(s.integer()),
					processed: s.integer(),
					exportDownloadUrl: s.optional(s.string()),
				}),
			},
		},
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("export:read"),
	},
);

/** `GET /tenants/:tenantId/subjects/export/:runId/download?ticket=`: the export; the ticket is the whole credential. */
export const SUBJECTS_EXPORT_DOWNLOAD = defineOperation(
	"subjectsExportDownload",
	routes.subjectsExportDownload,
	{
		summary: "Download a subject export",
		tags: ["Subjects"],
		params: s.object({ tenantId: s.string(), runId: s.string() }),
		query: s.object({ ticket: s.string() }),
		responses: {
			200: {
				description: "The export, one NDJSON line per subject",
				body: { [NDJSON]: s.string() },
			},
		},
		problems: ["invalidTicket", "notFound"],
		security: [],
	},
);

/** Every operation in this area, in route-map order, for the document to list. */
export const SUBJECTS_OPERATIONS = [
	SUBJECTS_CREATE,
	SUBJECTS_LIST,
	SUBJECTS_READ,
	SUBJECTS_UPDATE,
	SUBJECTS_BLOCK,
	SUBJECTS_UNBLOCK,
	SUBJECTS_DELETE,
	SUBJECT_IDENTIFIERS_ADD,
	SUBJECT_IDENTIFIERS_VERIFY,
	SUBJECT_IDENTIFIERS_SET_PRIMARY,
	SUBJECT_IDENTIFIERS_REMOVE,
	SUBJECTS_IMPORT_BEGIN,
	SUBJECTS_IMPORT_STATUS,
	SUBJECTS_IMPORT_DOWNLOAD,
	SUBJECTS_EXPORT_BEGIN,
	SUBJECTS_EXPORT_STATUS,
	SUBJECTS_EXPORT_DOWNLOAD,
] as const;
